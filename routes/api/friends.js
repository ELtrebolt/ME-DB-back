const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../../models/User');

const { requireAuth } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// @route POST api/friends/request/:username
// @description Send friend request to a user
router.post('/request/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserID = req.user.ID;

    // Prevent sending request to yourself
    if (req.user.username === username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send friend request to yourself' 
      });
    }

    // Find the target user
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const targetUserID = targetUser.ID;

    // Check if already friends
    const currentUser = await User.findOne({ ID: currentUserID });
    if (currentUser.friends && currentUser.friends.includes(targetUserID)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already friends with this user' 
      });
    }

    // Check if there's already a pending request (either direction)
    const existingRequest = currentUser.friendRequests?.find(
      req => (req.from === currentUserID && req.to === targetUserID && req.status === 'pending') ||
             (req.from === targetUserID && req.to === currentUserID && req.status === 'pending')
    );

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'Friend request already exists' 
      });
    }

    // Create friend request in both users' friendRequests arrays
    const friendRequest = {
      from: currentUserID,
      to: targetUserID,
      status: 'pending',
      createdAt: new Date()
    };

    // Add to current user's friendRequests
    await User.findOneAndUpdate(
      { ID: currentUserID },
      { $push: { friendRequests: friendRequest } }
    );

    // Add to target user's friendRequests
    await User.findOneAndUpdate(
      { ID: targetUserID },
      { $push: { friendRequests: friendRequest } }
    );

    res.json({ 
      success: true, 
      message: 'Friend request sent successfully',
      requestId: friendRequest._id || friendRequest.createdAt.getTime()
    });
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// @route POST api/friends/accept/:username
// @description Accept a friend request from a specific user
router.post('/accept/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserID = req.user.ID;

    // Find the sender user
    const senderUser = await User.findOne({ username });
    if (!senderUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const senderID = senderUser.ID;

    // Find current user
    const currentUser = await User.findOne({ ID: currentUserID });
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Current user not found' 
      });
    }

    // Find the incoming request (where current user is the 'to')
    const requestIndex = currentUser.friendRequests?.findIndex(
      req => req.from === senderID && 
             req.to === currentUserID && 
             req.status === 'pending'
    );

    if (requestIndex === -1 || requestIndex === undefined) {
      return res.status(404).json({ 
        success: false, 
        message: 'Friend request not found' 
      });
    }

    // Update request status to 'accepted' in current user
    currentUser.friendRequests[requestIndex].status = 'accepted';
    await currentUser.save();

    // Update request status in sender user
    const senderUserDoc = await User.findOne({ ID: senderID });
    if (senderUserDoc) {
      const senderRequestIndex = senderUserDoc.friendRequests?.findIndex(
        req => req.from === senderID && 
               req.to === currentUserID && 
               req.status === 'pending'
      );
      if (senderRequestIndex !== -1 && senderRequestIndex !== undefined) {
        senderUserDoc.friendRequests[senderRequestIndex].status = 'accepted';
        await senderUserDoc.save();
      }
    }

    // Add to friends arrays (if not already there)
    await User.findOneAndUpdate(
      { ID: currentUserID },
      { $addToSet: { friends: senderID } }
    );

    await User.findOneAndUpdate(
      { ID: senderID },
      { $addToSet: { friends: currentUserID } }
    );

    res.json({ 
      success: true, 
      message: 'Friend request accepted' 
    });
  } catch (err) {
    console.error('Error accepting friend request:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// @route POST api/friends/reject/:username
// @description Reject a friend request from a specific user
router.post('/reject/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserID = req.user.ID;

    // Find the sender user
    const senderUser = await User.findOne({ username });
    if (!senderUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const senderID = senderUser.ID;

    // Find current user
    const currentUser = await User.findOne({ ID: currentUserID });
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Current user not found' 
      });
    }

    // Find the incoming request
    const requestIndex = currentUser.friendRequests?.findIndex(
      req => req.from === senderID && 
             req.to === currentUserID && 
             req.status === 'pending'
    );

    if (requestIndex === -1 || requestIndex === undefined) {
      return res.status(404).json({ 
        success: false, 
        message: 'Friend request not found' 
      });
    }

    // Update request status to 'rejected' in current user
    currentUser.friendRequests[requestIndex].status = 'rejected';
    await currentUser.save();

    // Update request status in sender user
    const senderUserDoc = await User.findOne({ ID: senderID });
    if (senderUserDoc) {
      const senderRequestIndex = senderUserDoc.friendRequests?.findIndex(
        req => req.from === senderID && 
               req.to === currentUserID && 
               req.status === 'pending'
      );
      if (senderRequestIndex !== -1 && senderRequestIndex !== undefined) {
        senderUserDoc.friendRequests[senderRequestIndex].status = 'rejected';
        await senderUserDoc.save();
      }
    }

    res.json({ 
      success: true, 
      message: 'Friend request rejected' 
    });
  } catch (err) {
    console.error('Error rejecting friend request:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// @route DELETE api/friends/:username
// @description Remove a friend (unfriend)
router.delete('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserID = req.user.ID;

    // Find the target user
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const targetUserID = targetUser.ID;

    // Remove from both users' friends arrays
    await User.findOneAndUpdate(
      { ID: currentUserID },
      { $pull: { friends: targetUserID } }
    );

    await User.findOneAndUpdate(
      { ID: targetUserID },
      { $pull: { friends: currentUserID } }
    );

    res.json({ 
      success: true, 
      message: 'Friend removed successfully' 
    });
  } catch (err) {
    console.error('Error removing friend:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// @route GET api/friends
// @description Get all friends with their profile info
router.get('/', async (req, res) => {
  try {
    const currentUserID = req.user.ID;
    const currentUser = await User.findOne({ ID: currentUserID });

    if (!currentUser || !currentUser.friends || currentUser.friends.length === 0) {
      return res.json({ 
        success: true, 
        friends: [] 
      });
    }

    // Get all friend users
    const friends = await User.find({ 
      ID: { $in: currentUser.friends } 
    }).select('ID username displayName profilePic isPublicProfile');

    res.json({ 
      success: true, 
      friends: friends.map(friend => ({
        ID: friend.ID,
        username: friend.username,
        displayName: friend.displayName,
        profilePic: friend.profilePic,
        isPublicProfile: friend.isPublicProfile
      }))
    });
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// @route GET api/friends/requests
// @description Get all friend requests (incoming and outgoing pending)
router.get('/requests', async (req, res) => {
  try {
    const currentUserID = req.user.ID;
    const currentUser = await User.findOne({ ID: currentUserID });

    if (!currentUser || !currentUser.friendRequests || currentUser.friendRequests.length === 0) {
      return res.json({ 
        success: true, 
        incoming: [], 
        outgoing: [] 
      });
    }

    // Separate incoming and outgoing requests
    const incomingRequests = currentUser.friendRequests.filter(
      req => req.to === currentUserID && req.status === 'pending'
    );
    const outgoingRequests = currentUser.friendRequests.filter(
      req => req.from === currentUserID && req.status === 'pending'
    );

    // Get user info for incoming requests
    const incomingUserIDs = incomingRequests.map(req => req.from);
    const incomingUsers = incomingUserIDs.length > 0 
      ? await User.find({ ID: { $in: incomingUserIDs } })
          .select('ID username displayName profilePic isPublicProfile')
      : [];

    // Get user info for outgoing requests
    const outgoingUserIDs = outgoingRequests.map(req => req.to);
    const outgoingUsers = outgoingUserIDs.length > 0
      ? await User.find({ ID: { $in: outgoingUserIDs } })
          .select('ID username displayName profilePic isPublicProfile')
      : [];

    // Map requests with user info
    const incoming = incomingRequests.map(req => {
      const user = incomingUsers.find(u => u.ID === req.from);
      return {
        from: {
          ID: user?.ID || req.from,
          username: user?.username || 'Unknown',
          displayName: user?.displayName || 'Unknown User',
          profilePic: user?.profilePic,
          isPublicProfile: user?.isPublicProfile || false
        },
        createdAt: req.createdAt
      };
    });

    const outgoing = outgoingRequests.map(req => {
      const user = outgoingUsers.find(u => u.ID === req.to);
      return {
        to: {
          ID: user?.ID || req.to,
          username: user?.username || 'Unknown',
          displayName: user?.displayName || 'Unknown User',
          profilePic: user?.profilePic,
          isPublicProfile: user?.isPublicProfile || false
        },
        createdAt: req.createdAt
      };
    });

    res.json({ 
      success: true, 
      incoming, 
      outgoing 
    });
  } catch (err) {
    console.error('Error fetching friend requests:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
