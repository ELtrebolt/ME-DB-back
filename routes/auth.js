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
    // User stored in req.session.passport.user, req.isAuthenticated();
    // console.log("Session:", req.session);
    if(req.user)
    {
        if(req.headers.userupdated)
        {
            console.log("Refreshing User from MongoDB")
            User.findOne({ ID: req.user.ID })
                .then(user => {
                if (user) {
                    req.user = user;
                    req.session.save(err => {
                        if (err) {
                          console.error('Error refreshing session:', err);
                        } else {
                          res.status(200).json({
                            success: true,
                            message: "successful",
                            user: req.user
                        })
                        }
                    });
                }
                else {
                    console.log("User Not Found")
                }})
        }
        else {
            res.status(200).json({
                success: true,
                message: "successful",
                user: req.user
            })
        }
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
    res.clearCookie('session');
    res.redirect(CLIENT_URL);
    // req.logout(function(err) {
    //     if (err) { console.log(err); }
    //     res.redirect(CLIENT_URL);
    //   });
})

module.exports = router;