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

    // Determine friendship status if user is authenticated
    let friendshipStatus = 'none';
    if (req.user) {
      const currentUser = await User.findOne({ ID: req.user.ID });
      if (currentUser) {
        if (currentUser.ID === user.ID) {
          friendshipStatus = 'self';
        } else if (currentUser.friends && currentUser.friends.includes(user.ID)) {
          friendshipStatus = 'friends';
        } else if (currentUser.friendRequests) {
          // Check if there's a pending request from current user to this user
          const outgoingRequest = currentUser.friendRequests.find(
            req => req.from === currentUser.ID && req.to === user.ID && req.status === 'pending'
          );
          if (outgoingRequest) {
            friendshipStatus = 'request_sent';
          } else {
            // Check if there's a pending request from this user to current user
            const incomingRequest = currentUser.friendRequests.find(
              req => req.from === user.ID && req.to === currentUser.ID && req.status === 'pending'
            );
            if (incomingRequest) {
              friendshipStatus = 'request_received';
            }
          }
        }
      }
    }

    // Get shared lists for this user
    const shareLinks = await ShareLink.find({ userID: user.ID });
    const order = user.sharedListsOrder || [];
    
    // Create a map for quick lookup
    const linkMap = new Map(shareLinks.map(link => [link.mediaType, link]));
    
    // Sort by custom order, then by mediaType for items not in order
    const orderedLists = [];
    const unorderedMediaTypes = new Set(shareLinks.map(link => link.mediaType));
    
    // Add items in the specified order
    order.forEach(mediaType => {
      if (linkMap.has(mediaType)) {
        orderedLists.push(linkMap.get(mediaType));
        unorderedMediaTypes.delete(mediaType);
      }
    });
    
    // Add remaining items sorted by mediaType
    const unorderedLists = Array.from(unorderedMediaTypes)
      .map(mediaType => linkMap.get(mediaType))
      .sort((a, b) => a.mediaType.localeCompare(b.mediaType));
    
    const allLists = orderedLists.concat(unorderedLists);
    
    const sharedLists = allLists.map(link => ({
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
      sharedLists,
      friendshipStatus
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
// @description Update user customizations (e.g. homePage, list descriptions)
router.put('/customizations', (req, res) => {
  const updates = {};
  
  // Handle homePage update (can set or clear)
  if (req.body.homePage !== undefined) {
    updates['customizations.homePage'] = req.body.homePage || '';
  }

  // Handle list description update
  if (req.body.description !== undefined && req.body.mediaType && req.body.listType) {
    const { description, mediaType, listType, isNewType } = req.body;
    const descriptionField = listType === 'to-do' ? 'todoDescription' : 'collectionDescription';
    
    if (isNewType) {
      updates[`newTypes.${mediaType}.${descriptionField}`] = description;
    } else {
      updates[`${mediaType}.${descriptionField}`] = description;
    }
  }

  User.findOneAndUpdate(
    { ID: req.user.ID },
    { $set: updates },
    { new: true }
  )
  .then(user => {
    // Session update is handled by deserializeUser on next request
    const logParts = [];
    if (req.body.homePage !== undefined) logParts.push(`homePage = "${req.body.homePage || '(cleared)'}"`);
    if (req.body.description !== undefined) logParts.push(`description for ${req.body.mediaType}/${req.body.listType}`);
    console.log(`Updated customizations: ${logParts.join(', ')}`);
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

  // Check if username is already taken (excluding current user)
  User.findOne({ username: trimmedUsername })
    .then(existingUser => {
      if (existingUser && existingUser.ID !== req.user.ID) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      
      // Update username
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
        // Handle duplicate key error (MongoDB error code 11000)
        if (err.code === 11000 || err.codeName === 'DuplicateKey') {
          console.error('Duplicate username error:', err);
          return res.status(400).json({ error: 'Username already taken' });
        }
        console.error('Error updating username:', err);
        res.status(400).json({ error: 'Unable to update username' });
      });
    })
    .catch(err => {
      console.error('Error checking username:', err);
      res.status(400).json({ error: 'Unable to update username' });
    });
});

// @route GET api/user/shared-lists
// @description Get all active share links for the current user
router.get('/shared-lists', async (req, res) => {
  try {
    const userID = req.user.ID;
    
    // Find all share links for this user
    const shareLinks = await ShareLink.find({ userID });
    
    // Get user to access sharedListsOrder
    const user = await User.findOne({ ID: userID });
    const order = user?.sharedListsOrder || [];
    
    // Create a map for quick lookup
    const linkMap = new Map(shareLinks.map(link => [link.mediaType, link]));
    
    // Sort by custom order, then by mediaType for items not in order
    const orderedLists = [];
    const unorderedMediaTypes = new Set(shareLinks.map(link => link.mediaType));
    
    // Add items in the specified order
    order.forEach(mediaType => {
      if (linkMap.has(mediaType)) {
        orderedLists.push(linkMap.get(mediaType));
        unorderedMediaTypes.delete(mediaType);
      }
    });
    
    // Add remaining items sorted by mediaType
    const unorderedLists = Array.from(unorderedMediaTypes)
      .map(mediaType => linkMap.get(mediaType))
      .sort((a, b) => a.mediaType.localeCompare(b.mediaType));
    
    const allLists = orderedLists.concat(unorderedLists);
    
    // Format the response
    const sharedLists = allLists.map(link => ({
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

// @route PUT api/user/shared-lists-order
// @description Update the order of shared lists
router.put('/shared-lists-order', async (req, res) => {
  try {
    const { order } = req.body; // Array of mediaTypes in desired order
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }
    
    await User.findOneAndUpdate(
      { ID: req.user.ID },
      { $set: { sharedListsOrder: order } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating shared lists order:', err);
    res.status(500).json({ error: 'Unable to update order' });
  }
});

  module.exports = router;