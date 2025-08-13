const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true
  },
  ID: {
    type: Number,
    required: true
  },
  mediaType: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  tier: {
    type: String,
    required: true
  },
  orderIndex: {
    type: Number,
    default: 0
  },
  toDo: {
    type: Boolean,
    required: true
  },
  year: {
    type: Number
  },
  tags: {
    type: Array
  },
  description: {
    type: String
  }
});

module.exports = Media = mongoose.model('Media', MediaSchema);