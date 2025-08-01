const express = require('express');
const router = express.Router();

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

// @route PUT api/user/mediaType/group/tier
// @description Update TierTitle name
router.put('/:mediaType/:group/:tier', (req, res) => {
    const mediaType = req.params.mediaType
    const group = req.params.group
    const tier = req.params.tier
    const mediaTypeLoc = req.body.newType ? 'newTypes.' : ''
    User.findOneAndUpdate(
        { ID: req.user.ID }, 
        { $set: { [`${mediaTypeLoc}${mediaType}.${group}Tiers.${tier}`]: req.body.newTitle } }
      )
      .then(oldUser => {
        console.log(`PUT /api/user/${mediaType}/${group}/${tier}:`);
        if (req.body.newType){
          req.session.passport.user.newTypes[mediaType][`${group}Tiers`][tier] = req.body.newTitle
          console.log(oldUser.newTypes.get(mediaType)[`${group}Tiers`][tier] , "->", req.body.newTitle)
        } else {
          req.session.passport.user[mediaType][`${group}Tiers`][tier] = req.body.newTitle
          console.log(oldUser[mediaType][`${group}Tiers`][tier] , "->", req.body.newTitle)
        }
        res.json({ msg: 'User Tier changed successfully!' })
      })
      .catch(error => {
        console.log(error);
        res.status(400).json({ error: 'Unable to Update User Tier' })
      })
  });

router.put('/newTypes', (req, res) => {
    const newTypeFields = {
      total: 0,
      collectionTiers: {
        S: "S Tier",
        A: "A Tier",
        B: "B Tier",
        C: "C Tier",
        D: "D Tier",
        F: "F Tier"
      },
      todoTiers: {
        S: "S Tier",
        A: "A Tier",
        B: "B Tier",
        C: "C Tier",
        D: "D Tier",
        F: "F Tier"
      }
    }
    const newType = req.body.newType
    User.findOneAndUpdate(
        { ID: req.user.ID }, 
        { $set: { [`newTypes.${newType}`] : newTypeFields } }, 
        { new: true }
      )
      .then(updatedUser => {
        const newTypes = [...updatedUser.newTypes.keys()]
        console.log('Created New Type', newType)
        req.session.passport.user.newTypes = updatedUser.newTypes
        res.json({ msg: 'New Type Created successfully!', newTypes:newTypes })
      })
      .catch(error => {
        console.log(error)
        res.status(400).json({ error: 'Unable to Add New Type' })
      })
  });

  module.exports = router;