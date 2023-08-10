const router = require("express").Router();
const passport = require("passport");

const CLIENT_URL = "http://localhost:3000"

router.get("/login/failed", (req, res) => {
    res.status(401).json({
        success: false,
        message: "failure"
    })
})

router.get("/login/success", (req, res) => {
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
    req.logout();
    res.redirect(CLIENT_URL);
})

module.exports = router;