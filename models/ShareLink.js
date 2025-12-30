const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ShareLinkSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userID: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    required: true
  },
  // Configuration for what is shared
  shareConfig: {
    collection: {
      type: Boolean,
      default: false
    },
    todo: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = ShareLink = mongoose.model('ShareLink', ShareLinkSchema);

