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
  username: {
    type: String
  },
  password: {
    type: String
  },

  movies: {
    collection:
    {
        tiers: mongoose.Schema.Types.Mixed,
        cards: mongoose.Schema.Types.Mixed
    },
    todo:
    {
        tiers: mongoose.Schema.Types.Mixed,
        cards: mongoose.Schema.Types.Mixed
    }
  },
  tv: {
    type: Date
  },
  anime: {
    type: String
  },
  games: {
    type: String
  },
  music: {
    type: String
  },
});

module.exports = User = mongoose.model('User', UserSchema);