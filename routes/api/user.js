const express = require('express');
const router = express.Router();

const User = require('../../models/User');
const ShareLink = require('../../models/ShareLink');

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

// @route GET api/user/public/:username
// @description Get public user profile info and shared lists
router.get('/public/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.isPublicProfile) {
      return res.status(403).json({ success: false, message: 'This profile is private' });
    }

    // Get shared lists for this user
    const shareLinks = await ShareLink.find({ userID: user.ID }).sort({ mediaType: 1 });
    const sharedLists = shareLinks.map(link => ({
      mediaType: link.mediaType,
      token: link.token,
      shareConfig: link.shareConfig
    }));

    res.json({
      success: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        profilePic: user.profilePic,
        isPublicProfile: user.isPublicProfile
      },
      sharedLists
    });
  } catch (err) {
    console.error('Error fetching public profile:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Apply authentication middleware to all subsequent routes
router.use(requireAuth);

// @route PUT api/user/visibility
// @description Toggle profile visibility
router.put('/visibility', (req, res) => {
  const { isPublicProfile } = req.body;
  
  User.findOneAndUpdate(
    { ID: req.user.ID },
    { $set: { isPublicProfile } },
    { new: true }
  )
  .then(user => {
    // Update session
    if (req.session.passport && req.session.passport.user) {
      req.session.passport.user.isPublicProfile = user.isPublicProfile;
    }
    res.json({ success: true, isPublicProfile: user.isPublicProfile });
  })
  .catch(err => {
    console.error('Error updating visibility:', err);
    res.status(400).json({ error: 'Unable to update visibility' });
  });
});

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

// @route PUT api/user/customizations
// @description Update user customizations (e.g. homePage)
router.put('/customizations', (req, res) => {
  const updates = {};
  if (req.body.homePage) {
    updates['customizations.homePage'] = req.body.homePage;
  }

  User.findOneAndUpdate(
    { ID: req.user.ID },
    { $set: updates },
    { new: true }
  )
  .then(user => {
    // Session update is handled by deserializeUser on next request
    console.log(`Updated customizations: homePage = "${req.body.homePage}"`);
    res.json({ msg: 'Customizations updated successfully', user: user });
  })
  .catch(err => {
    console.error('Error updating customizations:', err);
    res.status(400).json({ error: 'Unable to update customizations' });
  });
});

// @route PUT api/user/username
// @description Update username
router.put('/username', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username cannot be empty' });
  }

  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length > 30) {
    return res.status(400).json({ error: 'Username must be 30 characters or less' });
  }

  // Standard username validation: alphanumeric and underscores only, must start with letter or number
  const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_]*$/;
  if (!usernameRegex.test(trimmedUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or number' });
  }

  User.findOneAndUpdate(
    { ID: req.user.ID },
    { $set: { username: trimmedUsername } },
    { new: true }
  )
  .then(user => {
    // Update session
    if (req.session.passport && req.session.passport.user) {
      req.session.passport.user.username = trimmedUsername;
    }
    console.log(`Updated username to: "${trimmedUsername}"`);
    res.json({ msg: 'Username updated successfully', username: user.username });
  })
  .catch(err => {
    console.error('Error updating username:', err);
    res.status(400).json({ error: 'Unable to update username' });
  });
});

// @route GET api/user/shared-lists
// @description Get all active share links for the current user
router.get('/shared-lists', async (req, res) => {
  try {
    const userID = req.user.ID;
    
    // Find all share links for this user
    const shareLinks = await ShareLink.find({ userID }).sort({ mediaType: 1 });
    
    // Format the response
    const sharedLists = shareLinks.map(link => ({
      mediaType: link.mediaType,
      token: link.token,
      shareConfig: link.shareConfig,
      createdAt: link.createdAt
    }));
    
    res.json({ success: true, sharedLists });
  } catch (err) {
    console.error('Error fetching shared lists:', err);
    res.status(500).json({ error: 'Unable to fetch shared lists' });
  }
});

  module.exports = router;