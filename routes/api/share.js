const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Load models
const ShareLink = require('../../models/ShareLink');
const Media = require('../../models/Media');
const User = require('../../models/User');

// Authentication middleware (only needed for creating links)
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required" 
    });
  }
  next();
};

// @route POST api/share
// @description Generate or retrieve existing share link
// @access Private
router.post('/', requireAuth, async (req, res) => {
  try {
    const { mediaType, shareConfig } = req.body;
    const userID = req.user.ID;

    // Validation
    if (!mediaType || !shareConfig || (!shareConfig.collection && !shareConfig.todo)) {
      return res.status(400).json({ error: 'Invalid share configuration' });
    }

    // Check if a link already exists for this user and mediaType
    // Note: This logic assumes one link per mediaType per user. 
    // If you want different links for different configs (e.g. one for collection, one for todo), 
    // you'd need to include shareConfig in the query or update the existing one.
    // Here we will UPDATE the existing link's config if it exists, to keep a single URL.
    
    let shareLink = await ShareLink.findOne({ userID, mediaType });

    if (shareLink) {
      // Update config and return existing token
      shareLink.shareConfig = shareConfig;
      await shareLink.save();
      return res.json({ success: true, token: shareLink.token, isExisting: true });
    }

    // Generate a unique token
    const token = crypto.randomBytes(16).toString('hex');

    const newShareLink = new ShareLink({
      token,
      userID,
      mediaType,
      shareConfig
    });

    await newShareLink.save();
    res.json({ success: true, token });

  } catch (error) {
    console.error('Error creating share link:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route GET api/share/status/:mediaType
// @description Check if a share link exists for this media type
// @access Private
router.get('/status/:mediaType', requireAuth, async (req, res) => {
  try {
    const { mediaType } = req.params;
    const userID = req.user.ID;

    const shareLink = await ShareLink.findOne({ userID, mediaType });

    if (shareLink) {
      return res.json({ 
        exists: true, 
        token: shareLink.token,
        shareConfig: shareLink.shareConfig
      });
    }

    res.json({ exists: false });

  } catch (error) {
    console.error('Error checking share status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route DELETE api/share/:mediaType
// @description Revoke share link
// @access Private
router.delete('/:mediaType', requireAuth, async (req, res) => {
  try {
    const { mediaType } = req.params;
    const userID = req.user.ID;

    await ShareLink.findOneAndDelete({ userID, mediaType });
    res.json({ success: true });

  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route GET api/share/:token
// @description Get shared data
// @access Public
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the share link
    const shareLink = await ShareLink.findOne({ token });
    if (!shareLink) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    const { userID, mediaType, shareConfig } = shareLink;

    // Build query based on config
    const query = {
      userID,
      mediaType
    };

    // If not sharing both, filter by toDo status
    if (shareConfig.collection && !shareConfig.todo) {
      query.toDo = false;
    } else if (!shareConfig.collection && shareConfig.todo) {
      query.toDo = true;
    }
    // If both are true, we don't need to filter by toDo (fetch all)

    // Fetch media
    const media = await Media.find(query).sort({ tier: 1, orderIndex: 1, title: 1 });

    // Fetch User to get display name (optional, but nice for "Users Collection")
    // Also fetch custom tier titles
    const user = await User.findOne({ ID: userID });
    
    // Extract tier titles
    let tierTitles = {};
    let collectionTierTitles = {};
    let todoTierTitles = {};
    
    if (user) {
        // Check if it's a newType (custom type)
        const isNewType = user.newTypes && (user.newTypes.get ? user.newTypes.get(mediaType) : user.newTypes[mediaType]);
        const typeData = isNewType ? (user.newTypes.get ? user.newTypes.get(mediaType) : user.newTypes[mediaType]) : user[mediaType];
        
        if (typeData) {
            collectionTierTitles = typeData.collectionTiers || {};
            todoTierTitles = typeData.todoTiers || {};
            
            // Set the default tierTitles based on what's being shared
            if (shareConfig.collection && !shareConfig.todo) {
                tierTitles = collectionTierTitles;
            } else if (!shareConfig.collection && shareConfig.todo) {
                tierTitles = todoTierTitles;
            } else {
                // If both are shared, default to collection titles
                tierTitles = collectionTierTitles;
            }
        }
    }

    console.log('Share API - tierTitles:', { tierTitles, collectionTierTitles, todoTierTitles, mediaType });

    const ownerName = user ? (user.displayName.split(' ')[0] || user.displayName) : 'User';

    res.json({
      success: true,
      media,
      shareConfig,
      mediaType,
      ownerName,
      tierTitles,
      collectionTierTitles,
      todoTierTitles
    });

  } catch (error) {
    console.error('Error fetching shared data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

