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
  email: {
    type: String
  },
  profilePic: {
    type: String
  },
  username: {
    type: String
  },
  password: {
    type: String
  },

  movies: {
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  tv: {
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  anime: {
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  },
  games: {
    collectionTiers: mongoose.Schema.Types.Mixed,
    todoTiers: mongoose.Schema.Types.Mixed,
    customAttributes: mongoose.Schema.Types.Mixed,
  }
});

module.exports = User = mongoose.model('User', UserSchema);