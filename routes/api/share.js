const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Load models
const ShareLink = require('../../models/ShareLink');
const Media = require('../../models/Media');
const User = require('../../models/User');

// Helper to escape regex special characters for safe case-insensitive matching
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// Helper to get shared data based on shareLink record
const getSharedData = async (shareLink) => {
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

  const ownerName = user ? (user.username || user.displayName.split(' ')[0] || user.displayName) : 'User';

  return {
    media,
    shareConfig,
    mediaType,
    ownerName,
    tierTitles,
    collectionTierTitles,
    todoTierTitles
  };
};

// @route GET api/share/user/:username/:mediaType/:id
// @description Get single shared media item by username, mediaType, and ID
// @access Public
router.get('/user/:username/:mediaType/:id', async (req, res) => {
  try {
    const { username, mediaType, id } = req.params;
    console.log(`[Share] Request for /user/${username}/${mediaType}/${id}`);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:184',message:'Route entry - raw params',data:{username,mediaType,id,parsedId:parseInt(id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    // 1. Find the user (case-insensitive username match)
    const user = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
    if (!user) {
      console.log(`[Share] User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:195',message:'User found',data:{userID:user.ID,userUsername:user.username,isPublic:user.isPublicProfile},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    // 2. Check if profile is public
    if (!user.isPublicProfile) {
      console.log(`[Share] Profile is private`);
      return res.status(403).json({ error: 'This profile is private' });
    }

    // 3. Find the share link for this mediaType
    const shareLink = await ShareLink.findOne({ 
      userID: user.ID, 
      mediaType: { $regex: new RegExp(`^${escapeRegex(mediaType)}$`, 'i') } 
    });
    if (!shareLink) {
      console.log(`[Share] No share link found for userID: ${user.ID}, mediaType: ${mediaType}`);
      return res.status(404).json({ error: 'Shared list not found' });
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:212',message:'ShareLink found',data:{shareLinkMediaType:shareLink.mediaType,shareConfig:shareLink.shareConfig,urlMediaType:mediaType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H5'})}).catch(()=>{});
    // #endregion

    // 4. Find the specific media item
    const mediaQuery = { ID: parseInt(id), userID: user.ID, mediaType: shareLink.mediaType };
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:218',message:'Media query',data:{query:mediaQuery},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion
    const media = await Media.findOne(mediaQuery);
    if (!media) {
      console.log(`[Share] Media not found: ${id}`);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:224',message:'Media NOT found - checking if any media exists',data:{queryUsed:mediaQuery},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return res.status(404).json({ error: 'Media not found' });
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e5e25c26-3643-4ef5-98e6-b35a84ec0731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'share.js:230',message:'Media found',data:{mediaID:media.ID,mediaType:media.mediaType,mediaToDo:media.toDo,mediaTitle:media.title},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H5'})}).catch(()=>{});
    // #endregion

    // 5. Verify the media item is shared (based on shareConfig)
    const { shareConfig } = shareLink;
    if (media.toDo && !shareConfig.todo) {
      return res.status(403).json({ error: 'This item is not shared' });
    }
    if (!media.toDo && !shareConfig.collection) {
      return res.status(403).json({ error: 'This item is not shared' });
    }

    // 6. Get tier titles
    const isNewType = user.newTypes && (user.newTypes.get ? user.newTypes.get(mediaType) : user.newTypes[mediaType]);
    const typeData = isNewType ? (user.newTypes.get ? user.newTypes.get(mediaType) : user.newTypes[mediaType]) : user[mediaType];
    
    let collectionTierTitles = {};
    let todoTierTitles = {};
    
    if (typeData) {
      collectionTierTitles = typeData.collectionTiers || {};
      todoTierTitles = typeData.todoTiers || {};
    }

    const ownerName = user.username || user.displayName?.split(' ')[0] || 'User';

    res.json({
      success: true,
      media,
      mediaType: shareLink.mediaType,
      ownerName,
      collectionTierTitles,
      todoTierTitles
    });

  } catch (error) {
    console.error('Error fetching shared media details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route GET api/share/user/:username/:mediaType
// @description Get shared data by username and mediaType
// @access Public
router.get('/user/:username/:mediaType', async (req, res) => {
  try {
    const { username, mediaType } = req.params;
    console.log(`[Share] Request for /user/${username}/${mediaType}`);

    // 1. Find the user (case-insensitive username match)
    const user = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
    if (!user) {
      console.log(`[Share] User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`[Share] Found user: ${user.username}, ID: ${user.ID}, isPublic: ${user.isPublicProfile}`);

    // 2. Check if profile is public
    if (!user.isPublicProfile) {
      console.log(`[Share] Profile is private`);
      return res.status(403).json({ error: 'This profile is private' });
    }

    // 3. Find the share link for this mediaType (case-insensitive match)
    const shareLink = await ShareLink.findOne({ 
      userID: user.ID, 
      mediaType: { $regex: new RegExp(`^${escapeRegex(mediaType)}$`, 'i') } 
    });
    if (!shareLink) {
      console.log(`[Share] No share link found for userID: ${user.ID}, mediaType: ${mediaType}`);
      // List all share links for this user
      const allLinks = await ShareLink.find({ userID: user.ID });
      console.log(`[Share] All share links for user:`, allLinks.map(l => l.mediaType));
      return res.status(404).json({ error: 'Shared list not found' });
    }
    console.log(`[Share] Found share link for mediaType: ${shareLink.mediaType}`);

    // 4. Get and return data
    const data = await getSharedData(shareLink);
    console.log(`[Share] Returning ${data.media?.length || 0} media items`);
    res.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Error fetching shared user data:', error);
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

    const data = await getSharedData(shareLink);
    res.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Error fetching shared data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

