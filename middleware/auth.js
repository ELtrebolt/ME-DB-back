const User = require('../models/User');

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Only write to DB if lastActiveAt is stale by more than 5 minutes
  const lastActive = req.user.lastActiveAt;
  if (!lastActive || (Date.now() - new Date(lastActive).getTime()) > FIVE_MINUTES_MS) {
    const now = new Date();
    try {
      const result = User.findOneAndUpdate(
        { ID: req.user.ID },
        { $set: { lastActiveAt: now } }
      );
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (e) {
      // Fire-and-forget: silently ignore if update fails
    }
    req.user.lastActiveAt = now;
  }

  next();
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

const adminAuth = (req, res, next) => {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
};

module.exports = { requireAuth, adminAuth };
