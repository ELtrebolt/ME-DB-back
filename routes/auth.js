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
        if(req.user)
        {
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

router.get("/google", (req, res, next) => {
  const prompt = req.query.prompt;
  const options = { scope: ["profile"] };
  if (prompt) options.prompt = prompt;
  return passport.authenticate("google", options)(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: '/login/failed' }),
  (req, res) => {
    res.redirect(CLIENT_URL + '/home');
  }
)

router.get("/logout", (req,res) => {
    req.logout(function(err) {
        if (err) { 
            console.log('Logout error:', err); 
            return res.redirect(CLIENT_URL);
        }
        req.session.destroy((err) => {
            if (err) {
                console.log('Session destroy error:', err);
            }
            res.clearCookie('session'); // Clear the session cookie
            res.redirect(CLIENT_URL);
        });
    });
})

module.exports = router;