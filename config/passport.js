const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require("passport");
const constants = require('./constants');

// Load User model
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: constants['SERVER_CALLBACK_URL']
  },

  function (accessToken, refreshToken, profile, done) {
    User.findOne({ ID: profile.id })
      .then(user => {
      if (user) {
        return done(null, user);
      } else {
        const newUser = new User({
          ID: profile.id,
          displayName: profile.displayName,
          // email: profile.emails[0].value,
          profilePic: profile.photos[0].value,
          newTypes: new Map(),
          anime: {
            total: 0,
            collectionTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            },
            todoTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            }
          },
          movies: {
            total: 0,
            collectionTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            },
            todoTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            }
          },
          tv: {
            total: 0,
            collectionTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            },
            todoTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            }
          },
          games: {
            total: 0,
            collectionTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            },
            todoTiers: {
              S: "S Tier",
              A: "A Tier",
              B: "B Tier",
              C: "C Tier",
              D: "D Tier",
              F: "F Tier"
            }
          }
        });
        newUser.save();
        return done(null, newUser);
      }
    })
    .catch(err => {
      return done(err, false);
    });  
  }
));

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user.id); // Storing user ID in the session
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  try {
    User.findById(id)
      .then((user) => {
        console.log("Deserialized user:", user ? user.displayName : "null");
        done(null, user);
      })
      .catch((err) => {
        console.error("Error deserializing user:", err);
        done(err, null);
      });
  } catch (error) {
    console.error("Error in deserializeUser:", error);
    done(error, null);
  }
});