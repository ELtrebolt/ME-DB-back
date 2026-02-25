/**
 * Express app for testing: same routes, no DB connection, no real session.
 * Set req.user via header X-Test-User-ID (and optionally X-Test-Username) to simulate auth.
 */
const express = require('express');
const mediaRouter = require('../routes/api/media');
const userRouter = require('../routes/api/user');
const statsRouter = require('../routes/api/stats');
const shareRouter = require('../routes/api/share');
const friendsRouter = require('../routes/api/friends');
const authRouter = require('../routes/auth');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.logout = req.logout || ((fn) => (fn ? fn(null) : undefined));
  req.session = req.session || {};
  req.session.destroy = req.session.destroy || ((cb) => cb && cb(null));
  const id = req.get('X-Test-User-ID');
  if (id) {
    req.user = { ID: id, username: req.get('X-Test-Username') || 'testuser' };
    req.session.passport = req.session.passport || {};
    req.session.passport.user = req.user;
  }
  next();
});

app.use('/api/media', mediaRouter);
app.use('/api/user', userRouter);
app.use('/api/stats', statsRouter);
app.use('/api/share', shareRouter);
app.use('/api/friends', friendsRouter);
app.use('/auth', authRouter);

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

module.exports = app;
