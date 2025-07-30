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
        .then(media => res.json({'media': media, 'uniqueTags': tags}))
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
      Media.create({...media, ...extra})
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
  req.body.tags = req.body.tags.map((item) => item.toLowerCase().replace(/ /g, '-'));
  Media.findOneAndUpdate(query, req.body)
    .then(media => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
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

module.exports = router;