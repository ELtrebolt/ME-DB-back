// Imports
const connectDB = require('./config/db');

const cookieSession = require("cookie-session");
const express = require("express");
const cors = require("cors");
const passportSetup = require("./config/passport");  // needed otherwise Unknown authentication strategy "google"
const passport = require("passport");
const authRoute = require("./routes/auth");
const media = require('./routes/api/media');
const constants = require('./config/constants');

const app = express();
connectDB();

// app.set('trust proxy', 1) 
app.use(
    cookieSession({ name: "session", keys: ["lama"], maxAge: 24 * 60 * 60 * 100 })
  );
// Problem using with passport 0.6.0: session.regenerate is not a function
// Solution from https://github.com/jaredhanson/passport/issues/904
// register regenerate & save after the cookieSession middleware initialization
app.use(function(request, response, next) {
  if (request.session && !request.session.regenerate) {
      request.session.regenerate = (cb) => {
          cb()
      }
  }
  if (request.session && !request.session.save) {
      request.session.save = (cb) => {
          cb()
      }
  }
  next()
})

// Setup CORS before defining Routes and Passport Initialization
app.use(
    cors({
        origin: constants['CLIENT_URL'],    // access-control-allow-origin
        methods: "GET,POST,PUT,DELETE",
        credentials: true                   // access-control-allow-credentials
    }));

// this function checks if req.session.passport.user exists
// if it does it will call passport.session()
// if it finds a serialized user object in the session,
// it will consider this req is authenticated. And then deserializeUser() will be invoked
// it will retrieve the user and attach it to req.user
app.use(passport.initialize());
app.use(passport.session());

// Middleware to parse JSON data
app.use(express.json());

// use Routes
app.use('/api/media', media);
app.use('/auth', authRoute);
// app.use((req, res, next) => {
//     // Only for local not deploy - not sure if this works tho
//     // res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
//     res.header('Access-Control-Allow-Origin', constants['CLIENT_URL']);
//     next();
// });

const port = process.env.PORT || 8082;
app.listen(port, () => console.log(`Server running on port ${port}`));