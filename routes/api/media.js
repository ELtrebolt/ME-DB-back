const express = require('express');
const router = express.Router();

const Media = require('../../models/Media');
const User = require('../../models/User');
const { normalizeTag } = require('../../utils/normalizeTag');
const { formatMediaRow } = require('../../utils/formatMediaRow');

const { requireAuth } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// @route GET api/media
// @description Get all media
// @access Private
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
      res.status(500).json({ error: 'Server error' });
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
// @access Private
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
      let total;
      
      // We must increment the total count atomically to prevent race conditions during bulk imports.
      // However, we first need to determine the *current* count to assign an ID to this new record.
      // NOTE: This logic is susceptible to race conditions if multiple requests come in exactly at the same time
      // (like in the import modal). The 'total' read here might be stale by the time we write.
      // Ideally, we should use findOneAndUpdate to increment AND return the new value in one go.
      
      // Sanitize mediaType to ensure valid object key
      const safeMediaType = mediaType.replace(/[^a-zA-Z0-9-_]/g, '-');
      const mediaTypeLocString = newType ? `newTypes.${safeMediaType}` : safeMediaType;
      
      // CRITICAL FIX: We are now treating 'total' as a High Water Mark (Sequence Number), not a count.
      // This means we always increment it to get a new unique ID, even if items were deleted.
      // The DELETE route has been updated to ONLY decrement if the *last* item (highest ID) is deleted.
      // This prevents ID reuse when items are deleted from the middle of the list.
      
      User.findOneAndUpdate(
        { ID: userID },
        { $inc: { [`${mediaTypeLocString}.total`]: 1 } },
        { new: true, upsert: true }
      ).lean() // Use lean() to get raw JSON and bypass Mongoose Map hydration issues
      .then(updatedUser => {
         // Get the NEW total which we just incremented.
         let newTotal;
         if (newType) {
             // With lean(), newTypes is a plain object
             const types = updatedUser.newTypes || {};
             // Access using safeMediaType
             const typeData = types[safeMediaType];
             newTotal = typeData ? typeData.total : 1;
         } else {
             newTotal = updatedUser[safeMediaType] ? updatedUser[safeMediaType].total : 1;
         }
         
         const extra = {'userID':userID, 'ID':newTotal}

         // place new record at end of its tier within the same group
         const placementQuery = { userID, mediaType, toDo: media.toDo, tier: media.tier };
         Media.find(placementQuery).sort({ orderIndex: -1 }).limit(1)
           .then(([last]) => {
             const nextOrder = last && typeof last.orderIndex === 'number' ? last.orderIndex + 1 : 0;
             return Media.create({ ...media, ...extra, orderIndex: nextOrder });
           })
           .then(media => {
             res.json({ msg: 'Media added successfully!', ID: newTotal })
           })
           .catch(error => {
             // If we hit a duplicate key error (which shouldn't happen with unique IDs, but just in case)
             if (error.code === 11000) {
                 console.error("Duplicate Key Error:", error);
                 return res.status(409).json({ error: 'Duplicate ID detected. Please try again.' });
             }
             console.error("Error creating media:", error);
             res.status(400).json({ error: 'Unable to Create Media' })
           });
      }).catch(err => {
         console.error("Error updating user count:", err);
         res.status(400).json({ error: 'Unable to Update User Count' });
      });
  })
  .catch(err => {
    console.error('Error in POST /api/media:', err)
    res.status(400).json({ error: 'Unable to Create Media' })
  });
});

// @route PUT api/media/:id
// @description Update media
// @access Private
router.put('/:mediaType/:ID', (req, res) => {
  const query = {
    userID: req.user.ID,
    mediaType: req.params.mediaType, 
    ID: req.params.ID, 
  };
  
  
  const { title, tier, toDo, year, tags, description, orderIndex } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (tier !== undefined) updates.tier = tier;
  if (toDo !== undefined) updates.toDo = toDo;
  if (year !== undefined) updates.year = year;
  if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.map(normalizeTag) : tags;
  if (description !== undefined) updates.description = description;
  if (orderIndex !== undefined) updates.orderIndex = orderIndex;

  Media.findOneAndUpdate(query, updates, { new: true })
    .then(media => {
      res.json({ msg: 'Updated successfully', media: media });
    })
    .catch(err => {
      console.error("Error updating media:", err);
      res.status(400).json({ error: 'Unable to update the Database' });
    });
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
// @access Private
router.delete('/:mediaType/:ID', async (req, res) => {
  const query = {
    userID: req.user.ID,
    mediaType: req.params.mediaType,
    ID: req.params.ID,
  };

  try {
    // Delete the media first so the count update only fires when the row really existed.
    const deleted = await Media.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ error: 'No such a media' });
    }

    // Decrement the per-type sequence counter only when the deleted item was the last in the sequence.
    const u = await User.findOne({ ID: req.user.ID });
    if (u) {
      const isStandard = !!u[req.params.mediaType];
      const customTypeData = !isStandard && u.newTypes
        ? (u.newTypes.get ? u.newTypes.get(req.params.mediaType) : u.newTypes[req.params.mediaType])
        : null;

      let total;
      let incPath;
      if (isStandard) {
        total = u[req.params.mediaType].total;
        incPath = `${req.params.mediaType}.total`;
      } else if (customTypeData) {
        total = customTypeData.total;
        incPath = `newTypes.${req.params.mediaType}.total`;
      }

      if (total !== undefined && total == req.params.ID) {
        try {
          await User.findOneAndUpdate(
            { ID: req.user.ID },
            { $inc: { [incPath]: -1 } }
          );
        } catch (countErr) {
          // Media is already gone; log and continue rather than failing the response.
          console.error('Error decrementing count after media delete:', countErr);
        }
      }
    }

    res.json({ msg: 'Media entry deleted successfully', toDo: deleted.toDo });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ error: 'Error deleting media' });
  }
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
    User.findOneAndUpdate(
      { ID: req.user.ID }, 
      { $unset: { [`newTypes.${mediaType}`]: 1 } },
      { new: true }
    )
    .then(updatedUser => {
      req.session.passport.user.newTypes = updatedUser.newTypes
      const msg = `User.newTypes.${mediaType} deleted`
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
      csvContent += formatMediaRow(media) + '\n';
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