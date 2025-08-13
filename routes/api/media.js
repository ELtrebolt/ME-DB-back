const express = require('express');
const router = express.Router();

// Load models
const Media = require('../../models/Media');
const User = require('../../models/User');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required" 
    });
  }
  next();
};

// Apply authentication middleware to all routes
router.use(requireAuth);

// @route GET api/media
// @description Get all media
// @access Public
router.get('/:mediaType/:group', (req, res) => {
  // if group is NotaNumber = collection or to-do or tags
  if(isNaN(req.params.group))
  {
    var tags = []
    Media.aggregate([
      { $match: { mediaType: req.params.mediaType, userID: req.user.ID } },
      
      // Unwind the tags array to create a separate document for each tag
      { $unwind: '$tags' },
    
      // Group the documents by the tags to make them unique
      { $group: { _id: '$tags' } },
    
      // Project the results to include only the tag field
      { $project: { _id: 0, tag: '$_id' } }
    ])
    .then(result => {
      tags = result.map(entry => entry.tag);
      if(req.params.group === 'tags') {
        res.json({'uniqueTags': tags});
      } else {
        Media.find({ userID: req.user.ID, 
          toDo: req.params.group === 'to-do',
          mediaType: req.params.mediaType })
        .then(media => {
          // Sort by tier then orderIndex asc (fallback to title)
          const ordered = media.sort((a, b) => {
            if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
            const ai = (typeof a.orderIndex === 'number') ? a.orderIndex : Number.MAX_SAFE_INTEGER;
            const bi = (typeof b.orderIndex === 'number') ? b.orderIndex : Number.MAX_SAFE_INTEGER;
            if (ai !== bi) return ai - bi;
            const at = a.title || '';
            const bt = b.title || '';
            return at.localeCompare(bt);
          });
          res.json({'media': ordered, 'uniqueTags': tags});
        })
        .catch(err => res.status(404).json({ msg: 'No Media found' }));
      }
    })
    .catch(error => {
      console.error(error);
    });
  }
  else
  {
    const conditions = {
      userID: req.user.ID,
      mediaType:req.params.mediaType,
      ID:req.params.group
    };
    Media.findOne(conditions)
      .then(media => res.json(media))
      .catch(err => res.status(404).json({ msg: 'No Media found' }));
  }
});

// @route POST api/media
// @description add/save media
// @access Public
router.post('/', (req, res) => {
  const userID = req.user.ID;
  const media = req.body.media
  const mediaType = media.mediaType
  const newType = req.body.newType
  const mediaTypeLoc2 = newType ? 'newTypes.' : ''
  if(media.tags && media.tags[0]) {
    media.tags = media.tags.map((item) => item.toLowerCase().replace(/ /g, '-'));
  }
  User.findOne({ ID: userID })
    .then(u => {
      const total = newType ? u.newTypes.get(mediaType).total+1 : u[mediaType].total+1
      extra = {'userID':userID, 'ID':total}
      // place new record at end of its tier within the same group
      const placementQuery = { userID, mediaType, toDo: media.toDo, tier: media.tier };
      Media.find(placementQuery).sort({ orderIndex: -1 }).limit(1)
        .then(([last]) => {
          const nextOrder = last && typeof last.orderIndex === 'number' ? last.orderIndex + 1 : 0;
          return Media.create({ ...media, ...extra, orderIndex: nextOrder });
        })
      .then(media => {
        console.log("Media created:", media.title);
        User.findOneAndUpdate(
          { ID: userID }, 
          { $inc: { [`${mediaTypeLoc2}${mediaType}.total`]: 1 } }, 
          { new: true } // Return the updated user document
        )
        .then(updatedUser => {
          // change req.user.total?
          const updatedMediaTypeLoc = newType ? updatedUser.newTypes.get(mediaType) : updatedUser[mediaType]
          console.log(`${mediaType} Count updated:`, updatedMediaTypeLoc.total);
          res.json({ msg: 'Media added successfully!' })
        })
        .catch(error => {
          console.log(error);
          res.status(400).json({ error: 'Unable to Update User Count' })
        })

      })
      .catch(err => res.status(400).json({ error: err }))
  })
  .catch(err => {
    console.log('1st Layer', err)
    res.status(400).json({ error: err })
  });
});

// @route PUT api/media/:id
// @description Update media
// @access Public
router.put('/:mediaType/:ID', (req, res) => {
  const query = {
    userID: req.user.ID,
    mediaType: req.params.mediaType, 
    ID: req.params.ID, 
  };
  if (Array.isArray(req.body.tags)) {
    req.body.tags = req.body.tags.map((item) => item.toLowerCase().replace(/ /g, '-'));
  }
  Media.findOneAndUpdate(query, req.body)
    .then(media => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route PUT api/media/:mediaType/:group/:tier/reorder
// @description Persist order within a tier by orderedIds
router.put('/:mediaType/:group/:tier/reorder', async (req, res) => {
  try {
    const userID = req.user.ID;
    const mediaType = req.params.mediaType;
    const group = req.params.group; // 'to-do' or 'collection'
    const tier = req.params.tier;
    const toDo = group === 'to-do';
    const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
    if (!orderedIds.length) return res.json({ msg: 'No changes' });

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { userID, mediaType, toDo, tier, ID: id },
        update: { $set: { orderIndex: index } }
      }
    }));
    await Media.bulkWrite(bulkOps);
    res.json({ msg: 'Reordered successfully' });
  } catch (err) {
    console.error('Error reordering:', err);
    res.status(500).json({ error: 'Unable to reorder' });
  }
});

// @route GET api/media/:id
// @description Delete media by id
// @access Public
router.delete('/:mediaType/:ID', (req, res) => {
  const query = {
    userID: req.user.ID,
    mediaType: req.params.mediaType, 
    ID: req.params.ID, 
  };

  User.findOne({ ID: req.user.ID })
    .then(u => {
      if(u[req.params.mediaType].total == req.params.ID) {
        User.findOneAndUpdate(
          { ID: req.user.ID }, 
          { $inc: { [`${req.params.mediaType}.total`]: -1 } }, 
          { new: true } // Return the updated user document
        )
        .then(updatedUser => {
          console.log(`${req.params.mediaType} Count updated:`, updatedUser[req.params.mediaType].total);
        })
        .catch((err) => {
          console.log('Error updating count in DELETE api/media');
        });
      }
    })
    .catch((err) => {
      console.log('Error finding user in DELETE api/media');
    });

  Media.findOneAndDelete(query)
  .then(media => {
    if (!media) {
      return res.status(404).json({ error: 'No such a media' });
    }
    res.json({ msg: 'Media entry deleted successfully', toDo: media.toDo });
  })
  .catch(err => {
    console.log('Error deleting media:', err);
    res.status(500).json({ error: 'Error deleting media' });
  });
});

router.delete('/:mediaType', (req, res) => {
  const mediaType = req.params.mediaType
  const query = {
    userID: req.user.ID,
    mediaType: mediaType
  };
  var deletedCount = 0;

  Media.deleteMany(query)
  .then(result => {
    deletedCount = result.deletedCount
    console.log(`All ${mediaType} records deleted: ${deletedCount}`);
    User.findOneAndUpdate(
      { ID: req.user.ID }, 
      { $unset: { [`newTypes.${mediaType}`]: 1 } },
      { new: true }
    )
    .then(updatedUser => {
      req.session.passport.user.newTypes = updatedUser.newTypes
      const msg = `User.newTypes.${mediaType} deleted`
      console.log(msg);
      res.json({ msg: msg});
    })
    .catch(error => {
      console.error('Error deleting user.newTypes:', error);
    });
  })
  .catch(error => {
    console.error(`Error deleting all ${mediaType} Media:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  });
})

// @route GET api/media/export
// @description Export all media for user as CSV
// @access Private
router.get('/export', async (req, res) => {
  try {
    const userID = req.user.ID;
    
    // Get all media for the user
    const allMedia = await Media.find({ userID }).sort({ mediaType: 1, title: 1 });
    
    if (allMedia.length === 0) {
      return res.json({
        success: true,
        csv: 'Media Type,Title,Tier,To-Do,Year,Tags,Description\n'
      });
    }
    
    // Create CSV header
    let csvContent = 'Media Type,Title,Tier,To-Do,Year,Tags,Description\n';
    
    // Add data rows
    allMedia.forEach(media => {
      const title = media.title ? `"${media.title.replace(/"/g, '""')}"` : '';
      const tier = media.tier || '';
      const toDo = media.toDo ? 'Yes' : 'No';
      const year = media.year || '';
      const tags = media.tags && media.tags.length > 0 ? `"${media.tags.join(', ')}"` : '';
      const description = media.description ? `"${media.description.replace(/"/g, '""')}"` : '';
      
      csvContent += `${media.mediaType},${title},${tier},${toDo},${year},${tags},${description}\n`;
    });
    
    res.json({
      success: true,
      csv: csvContent
    });
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error exporting data' 
    });
  }
});

module.exports = router;