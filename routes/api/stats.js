const express = require('express');
const router = express.Router();

// Load models
const Media = require('../../models/Media');
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

// @route GET api/stats
// @description Get all statistics for the dashboard
// @access Private
router.get('/', async (req, res) => {
  try {
    const userID = req.user.ID;
    
    // Get user data for custom types
    const user = await User.findOne({ ID: userID });
    
    // Properly extract custom types from Mongoose Map
    let customTypes = [];
    if (user.newTypes && user.newTypes instanceof Map) {
      // For Mongoose Map, use the keys() method
      customTypes = Array.from(user.newTypes.keys());
    } else if (user.newTypes) {
      // Fallback for regular objects
      customTypes = Object.keys(user.newTypes);
    }
    
    console.log('User ID:', userID);
    console.log('User newTypes:', user.newTypes);
    console.log('Custom types:', customTypes);
    
    // Get all media for the user
    const allMedia = await Media.find({ userID });
    console.log('Total media found:', allMedia.length);
    
    // Calculate total counts
    const totalRecords = allMedia.length;
    const totalCollection = allMedia.filter(media => !media.toDo).length;
    const totalToDo = allMedia.filter(media => media.toDo).length;
    
    // Distribution by Type (Standard + Custom)
    const standardTypes = ['anime', 'tv', 'movies', 'games'];
    const allTypes = [...standardTypes, ...customTypes];
    
    const typeDistribution = {};
    allTypes.forEach(type => {
      const count = allMedia.filter(media => media.mediaType === type).length;
          // Include all types, even if they have 0 records
    typeDistribution[type] = count;
  });
  
    
    // Distribution by Year
    const yearDistribution = {};
    allMedia.forEach(media => {
      if (media.year) {
        yearDistribution[media.year] = (yearDistribution[media.year] || 0) + 1;
      }
    });
    
    // Distribution by Tier
    const tierDistribution = {};
    allMedia.forEach(media => {
      if (media.tier) {
        tierDistribution[media.tier] = (tierDistribution[media.tier] || 0) + 1;
      }
    });
    
    // Distribution by Year with filter (All/ToDo/Collection)
    const yearDistributionByFilter = {
      all: yearDistribution,
      toDo: {},
      collection: {}
    };
    
    allMedia.forEach(media => {
      if (media.year) {
        if (media.toDo) {
          yearDistributionByFilter.toDo[media.year] = (yearDistributionByFilter.toDo[media.year] || 0) + 1;
        } else {
          yearDistributionByFilter.collection[media.year] = (yearDistributionByFilter.collection[media.year] || 0) + 1;
        }
      }
    });
    
    // Distribution by Tier for ToDo and Collection
    const tierDistributionByGroup = {
      toDo: {},
      collection: {}
    };
    
    allMedia.forEach(media => {
      if (media.tier) {
        const group = media.toDo ? 'toDo' : 'collection';
        tierDistributionByGroup[group][media.tier] = (tierDistributionByGroup[group][media.tier] || 0) + 1;
      }
    });
    
    // Distribution of Tier by Type for ToDo and Collection (for 4th row charts)
    const tierByTypeToDo = {};
    const tierByTypeCollection = {};
    
    allTypes.forEach(type => {
      const typeMedia = allMedia.filter(media => media.mediaType === type);
      const toDoTierCounts = {};
      const collectionTierCounts = {};
      
      typeMedia.forEach(media => {
        if (media.tier) {
          if (media.toDo) {
            toDoTierCounts[media.tier] = (toDoTierCounts[media.tier] || 0) + 1;
          } else {
            collectionTierCounts[media.tier] = (collectionTierCounts[media.tier] || 0) + 1;
          }
        }
      });
      
      if (Object.keys(toDoTierCounts).length > 0) {
        tierByTypeToDo[type] = toDoTierCounts;
      }
      if (Object.keys(collectionTierCounts).length > 0) {
        tierByTypeCollection[type] = collectionTierCounts;
      }
    });
    
    // Distribution of Tier by Type (Stacked bar chart data for 5th row)
    const tierByTypeDistribution = {};
    allTypes.forEach(type => {
      const typeMedia = allMedia.filter(media => media.mediaType === type);
      const tierCounts = {};
      
      typeMedia.forEach(media => {
        if (media.tier) {
          tierCounts[media.tier] = (tierCounts[media.tier] || 0) + 1;
        }
      });
      
      if (Object.keys(tierCounts).length > 0) {
        tierByTypeDistribution[type] = tierCounts;
      }
    });
    
    res.json({
      success: true,
      data: {
        totals: {
          totalRecords,
          totalCollection,
          totalToDo
        },
        typeDistribution,
        yearDistribution,
        tierDistribution,
        yearDistributionByFilter,
        tierDistributionByGroup,
        tierByTypeToDo,
        tierByTypeCollection,
        tierByTypeDistribution,
        customTypes
      }
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics' 
    });
  }
});

module.exports = router; 