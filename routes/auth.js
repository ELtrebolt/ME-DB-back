const router = require("express").Router();
const passport = require("passport");
const constants = require('../config/constants');

const CLIENT_URL = constants['CLIENT_URL']

router.get("/login/failed", (req, res) => {
    res.status(401).json({
        success: false,
        message: "failure"
    })
})

router.get("/login/success", (req, res) => {
    // User stored in req.session.passport.user
    console.log("Authenticated:", req.isAuthenticated());
    console.log("Session:", req.session);
    if(req.session.passport.user)
    {
        res.status(200).json({
            success: true,
            message: "Kinda Successful",
            user: req.session.passport.user,
            cookies: req.cookies
        })
    }
    if(req.user)
    {
        res.status(200).json({
            success: true,
            message: "successful",
            user: req.user,
            cookies: req.cookies
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
})

router.get("/google", passport.authenticate("google", {scope:["profile"]}));

router.get("/google/callback", passport.authenticate("google", {
    successRedirect: CLIENT_URL + '/home',
    failureRedirect: '/login/failed'
}))

router.get("/logout", (req,res) => {
    req.session = null;
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect(CLIENT_URL);
      });
})

module.exports = router;