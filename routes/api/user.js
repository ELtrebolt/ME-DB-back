const express = require('express');
const router = express.Router();

const User = require('../../models/User');

// @route PUT api/media/:id
// @description Update media
// @access Public
router.put('/:mediaType/:group/:tier', (req, res) => {
    // group = 'todo' ? (req.params.group == 'to-do') : 'collection'
    const mediaType = req.params.mediaType
    const group = req.params.group
    const tier = req.params.tier
    User.findOneAndUpdate(
        { ID: req.user.ID }, 
        { $set: { [`${mediaType}.${group}Tiers.${tier}`]: req.body.newTitle } }
      )
      .then(oldUser => {
        req.session.passport.user[mediaType][`${group}Tiers`][tier] = req.body.newTitle
        console.log(`PUT /api/user/${mediaType}/${group}/${tier}:`, oldUser[mediaType][`${group}Tiers`][tier] , "->", req.body.newTitle);
        res.json({ msg: 'User Tier changed successfully!' })
      })
      .catch(error => {
        res.status(400).json({ error: 'Unable to Update User Tier' })
      })
  });

  module.exports = router;