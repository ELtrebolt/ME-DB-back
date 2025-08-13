const router = require("express").Router();
const passport = require("passport");
const constants = require('../config/constants');

const CLIENT_URL = constants['CLIENT_URL'] || 'http://localhost:3000'

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Auth service is running",
    timestamp: new Date().toISOString()
  });
});

router.get("/login/failed", (req, res) => {
    res.status(401).json({
        success: false,
        message: "failure"
    })
})

router.get("/login/success", (req, res) => {
    try {
        // User stored in req.session.passport.user, req.isAuthenticated();
        console.log("Session:", req.session);
        console.log("User:", req.user);
        
        if(req.user)
        {
            // Extend session by updating the session (safely)
            if (req.session && typeof req.session.touch === 'function') {
                req.session.touch();
            }
            res.status(200).json({
                success: true,
                message: "successful",
                user: req.user
            })
        }
        else
        {
            res.status(200).json({
                success: false,
                message: "failure",
                user: null,
            })
        }
    } catch (error) {
        console.error("Error in /login/success:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
})

router.get("/google", passport.authenticate("google", {scope:["profile"]}));

router.get(
  "/google/callback",
  (req, res, next) => {
    // Explicitly allow proxy headers for production behind reverse proxy
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      // continue; do not block
    }
    next();
  },
  passport.authenticate("google", {
    successRedirect: CLIENT_URL + '/home',
    failureRedirect: '/login/failed'
  })
)

router.get("/logout", (req,res) => {
    req.session = null;
    res.clearCookie('session');
    res.redirect(CLIENT_URL);
    // req.logout(function(err) {
    //     if (err) { console.log(err); }
    //     res.redirect(CLIENT_URL);
    //   });
})

module.exports = router;