const mongoose = require('mongoose');

const webVitalSchema = new mongoose.Schema({
  name: { type: String, enum: ['LCP', 'CLS', 'INP', 'TTFB'], required: true },
  value: { type: Number, required: true },
  rating: { type: String, enum: ['good', 'needs-improvement', 'poor'] },
  route: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: false });

webVitalSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
webVitalSchema.index({ name: 1, route: 1, timestamp: 1 });

module.exports = mongoose.model('WebVital', webVitalSchema);
