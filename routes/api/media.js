const express = require('express');
const router = express.Router();

// Load models
const Media = require('../../models/Media');
const User = require('../../models/User');

// @route GET api/media
// @description Get all media
// @access Public
router.get('/:mediaType/:group', (req, res) => {
  Media.find({ userID: req.user.ID, 
            toDo: req.params.group === 'to-do',
            mediaType: req.params.mediaType })
    .then(media => res.json(media))
    .catch(err => res.status(404).json({ message: 'No Media found' }));
});

// @route GET api/media/:id
// @description Get single media by id
// @access Public
router.get('/:mediaType/:ID', (req, res) => {
  Media.find({ userID: req.user.ID, mediaType:req.params.mediaType, ID:req.params.ID })
    .then(media => res.json(media))
    .catch(err => res.status(404).json({ message: 'No Media found' }));
});

// @route GET api/media
// @description add/save media
// @access Public
router.post('/', (req, res) => {
  const userID = req.user.ID;
  const mediaType = req.body.mediaType
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

  Media.findOneAndRemove(query)
    .then(media => res.json({ mgs: 'Media entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a media' }));
});

module.exports = router;