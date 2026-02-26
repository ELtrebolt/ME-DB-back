const mongoose = require('mongoose');

// flexible Schema
const UserSchema = new mongoose.Schema({
  ID: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  lastActiveAt: {
    type: Date
  },
  displayName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  isPublicProfile: {
    type: Boolean,
    default: false
  },
  profilePic: {
    type: String
  },
  newTypes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  customizations: {
    homePage: String
  },
  sharedListsOrder: {
    type: [String],
    default: []
  },
  friends: {
    type: [String],
    default: []
  },
  friendRequests: [{
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  movies: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
    collectionDescription: String,
    todoDescription: String,
  },
  tv: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
    collectionDescription: String,
    todoDescription: String,
  },
  anime: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
    collectionDescription: String,
    todoDescription: String,
  },
  games: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
    collectionDescription: String,
    todoDescription: String,
  }
}, { timestamps: true });

module.exports = User = mongoose.model('User', UserSchema);