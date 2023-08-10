const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  userID: {
    type: String,
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
  toDo: {
    type: Boolean,
    required: true
  },

  year: {
    type: Date
  },
  customAttributes: mongoose.Schema.Types.Mixed
});

module.exports = Card = mongoose.model('Card', CardSchema);