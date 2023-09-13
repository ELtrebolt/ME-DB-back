const express = require('express');
const router = express.Router();

// Load models
const Media = require('../../models/Media');
const User = require('../../models/User');

// @route GET api/media
// @description Get all media
// @access Public
router.get('/:mediaType/:group', (req, res) => {
  if(isNaN(req.params.group))
  {
    Media.find({ userID: req.user.ID, 
      toDo: req.params.group === 'to-do',
      mediaType: req.params.mediaType })
    .then(media => res.json(media))
    .catch(err => res.status(404).json({ message: 'No Media found' }));
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
      .catch(err => res.status(404).json({ message: 'No Media found' }));
  }
});

// @route POST api/media
// @description add/save media
// @access Public
router.post('/', (req, res) => {
  const userID = req.user.ID;
  const mediaType = req.body.mediaType
  if(req.body.tags && req.body.tags[0]) {
    req.body.tags = req.body.tags.map((item) => item.toLowerCase().replace(/ /g, '-'));
  }
  User.findOne({ ID: userID })
    .then(u => {

      extra = {'userID':userID, 'ID':u[mediaType].total+1}
      Media.create({...req.body, ...extra})
      .then(media => {
        console.log("Media created:", media.title);
        User.findOneAndUpdate(
          { ID: userID }, 
          { $inc: { [`${mediaType}.total`]: 1 } }, 
          { new: true } // Return the updated user document
        )
        .then(updatedUser => {
          console.log(`${mediaType} Count updated:`, updatedUser[mediaType].total);
          res.json({ msg: 'Media added successfully!' })
        })
        .catch(error => {
          res.status(400).json({ error: 'Unable to Update User Count' })
        })

      })
      .catch(err => res.status(400).json({ error: err }))
  })
  .catch(err => res.status(400).json({ error: err }));
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

  Media.findOneAndRemove(query)
  .then(media => res.json({ mgs: 'Media entry deleted successfully', toDo: media.toDo }))
  .catch(err => res.status(404).json({ error: 'No such a media' }));
});

module.exports = router;