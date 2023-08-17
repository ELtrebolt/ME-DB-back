const mongoose = require('mongoose');

// flexible Schema
const UserSchema = new mongoose.Schema({
  ID: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  profilePic: {
    type: String
  },

  movies: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  tv: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  anime: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  games: {
    total: Number,
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  }
});

module.exports = User = mongoose.model('User', UserSchema);