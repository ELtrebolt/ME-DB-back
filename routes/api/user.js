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
        { $set: { [`${mediaTypeLoc}${mediaType}.${group}Tiers.${tier}`]: req.body.newTitle } },
        { new: true }
      )
      .then(updatedUser => {
        try {
          if (req.body.newType){
            // Normalize Map -> plain object in session for safe access
            const newTypesObj = Object.fromEntries(updatedUser.newTypes);
            req.session.passport.user.newTypes = newTypesObj;
          } else {
            if (!req.session.passport.user[mediaType]) {
              req.session.passport.user[mediaType] = {};
            }
            if (!req.session.passport.user[mediaType][`${group}Tiers`]) {
              req.session.passport.user[mediaType][`${group}Tiers`] = {};
            }
            req.session.passport.user[mediaType][`${group}Tiers`][tier] = req.body.newTitle;
          }
          console.log(`Updated tier: ${mediaType} ${group} ${tier} = "${req.body.newTitle}"`);
          res.json({ msg: 'User Tier changed successfully!' })
        } catch (sessionError) {
          console.error('Session update error:', sessionError);
          // Even if session update fails, the database was updated successfully
          res.json({ msg: 'User Tier changed successfully! (Session update failed)' })
        }
      })
      .catch(error => {
        console.error('Error updating user tier:', error);
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
        req.session.passport.user.newTypes = updatedUser.newTypes
        console.log('Created new media type:', newType);
        res.json({ msg: 'New Type Created successfully!', newTypes:newTypes })
      })
      .catch(error => {
        console.error('Error adding new type:', error);
        res.status(400).json({ error: 'Unable to Add New Type' })
      })
  });

  module.exports = router;