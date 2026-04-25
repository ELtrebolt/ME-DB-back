const express = require('express');
const router = express.Router();

const User = require('../../models/User');
const ShareLink = require('../../models/ShareLink');
const { validateUsername } = require('../../utils/validateUsername');

const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../../middleware/auth');

// Path-segment allowlists for routes that interpolate req.params into Mongo update paths.
// Without these, a crafted URL like /api/user/__proto__/x/x or /api/user/email/x/x
// can cause $set to write to arbitrary fields of the user document.
const FIXED_MEDIA_TYPES = new Set(['movies', 'tv', 'anime', 'games']);
const VALID_TIER_GROUPS = new Set(['collection', 'todo']);
const SAFE_KEY_REGEX = /^[A-Za-z0-9_-]{1,30}$/;

const publicProfileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// @route GET api/user/public/:username
// @description Get public user profile info and shared lists
router.get('/public/:username', publicProfileLimiter, async (req, res) => {
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
router.put('/:mediaType/:group/:tier', async (req, res) => {
    const mediaType = req.params.mediaType
    const group = req.params.group
    const tier = req.params.tier
    const isCustom = !!req.body.newType
    const mediaTypeLoc = isCustom ? 'newTypes.' : ''

    if (!VALID_TIER_GROUPS.has(group)) {
      return res.status(400).json({ error: 'Invalid group' });
    }
    if (typeof tier !== 'string' || !SAFE_KEY_REGEX.test(tier)) {
      return res.status(400).json({ error: 'Invalid tier key' });
    }

    if (isCustom) {
      // For custom types, require the key to exist on this user's newTypes Map.
      // Membership check is stronger than a regex because it confirms the key was
      // already created via the validated /newTypes endpoint.
      try {
        const u = await User.findOne({ ID: req.user.ID });
        const hasCustomType = u && u.newTypes && (
          (typeof u.newTypes.has === 'function' && u.newTypes.has(mediaType)) ||
          (typeof u.newTypes === 'object' && Object.prototype.hasOwnProperty.call(u.newTypes, mediaType))
        );
        if (!hasCustomType) {
          return res.status(400).json({ error: 'Unknown custom media type' });
        }
      } catch (lookupErr) {
        console.error('Error verifying custom media type:', lookupErr);
        return res.status(500).json({ error: 'Unable to Update User Tier' });
      }
    } else if (!FIXED_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    const newTitle = req.body.newTitle;
    if (!newTitle || typeof newTitle !== 'string' || newTitle.trim().length === 0 || newTitle.length > 50) {
      return res.status(400).json({ error: 'Tier title must be between 1 and 50 characters' });
    }

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

router.put('/newTypes', async (req, res) => {
    const newType = req.body.newType;
    if (!newType || typeof newType !== 'string' || newType.trim().length === 0 || newType.length > 30) {
      return res.status(400).json({ error: 'Type name must be between 1 and 30 characters' });
    }
    if (!SAFE_KEY_REGEX.test(newType)) {
      return res.status(400).json({ error: 'Type name may only contain letters, numbers, hyphens, and underscores' });
    }
    if (FIXED_MEDIA_TYPES.has(newType)) {
      return res.status(400).json({ error: 'Type name conflicts with a built-in type' });
    }

    try {
      const user = await User.findOne({ ID: req.user.ID });
      const currentCount = user && user.newTypes
        ? (user.newTypes.size !== undefined ? user.newTypes.size : Object.keys(user.newTypes).length)
        : 0;
      if (currentCount >= 8) {
        return res.status(400).json({ error: 'Maximum custom types reached (8)' });
      }

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
      };

      const updatedUser = await User.findOneAndUpdate(
        { ID: req.user.ID },
        { $set: { [`newTypes.${newType}`]: newTypeFields } },
        { new: true }
      );
      const newTypes = [...updatedUser.newTypes.keys()];
      req.session.passport.user.newTypes = updatedUser.newTypes;
      res.json({ msg: 'New Type Created successfully!', newTypes });
    } catch (error) {
      console.error('Error adding new type:', error);
      res.status(400).json({ error: 'Unable to Add New Type' });
    }
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
  const validation = validateUsername(username);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const trimmedUsername = username.trim();

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