// Imports
const connectDB = require('./config/db');

const cookieSession = require("cookie-session");
const express = require("express");
const cors = require("cors");
const passportSetup = require("./config/passport");  // needed otherwise Unknown authentication strategy "google"
const passport = require("passport");
const authRoute = require("./routes/auth");
const media = require('./routes/api/media');
const userApi = require('./routes/api/user');
const statsApi = require('./routes/api/stats');
const constants = require('./config/constants');

const app = express();
connectDB();

// For Cross Domain requests (Localhost 3000 & 8082 or Vercel client & Render server or example.com & api.example.com)
// Setup CORS before Cookie-Session, Routes and Passport Initialization
app.set('trust proxy', 1) 
app.use(
    cors({
        origin: constants['CLIENT_URL'] || 'http://localhost:3000',    // access-control-allow-origin
        methods: "GET,POST,PUT,DELETE",
        credentials: true,                   // access-control-allow-credentials
        allowedHeaders:   "Content-Type,Authorization",    // Access-Control-Allow-Headers
    }));
if(process.env.STATUS === 'local' || !process.env.STATUS) {
    app.use(
        cookieSession({ 
            name: "session", 
            keys: ["lama"], 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        })
      );
}
else if(process.env.STATUS === 'deploy')
{
    app.use(
        cookieSession({ 
            name: "session", 
            keys: ["lama"], 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure: true,
            sameSite: 'none'
        })
      );
}

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

// Middleware to parse JSON data comes before passport - for sending POST data
app.use(express.json());

// this function checks if req.session.passport.user exists
// if it does it will call passport.session()
// if it finds a serialized user object in the session,
// it will consider this req is authenticated. And then deserializeUser() will be invoked
// it will retrieve the user and attach it to req.user
app.use(passport.initialize());
app.use(passport.session());

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running correctly' });
});

// use Routes
app.use('/api/media', media);
app.use('/api/user', userApi);
app.use('/api/stats', statsApi);
app.use('/auth', authRoute);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const port = process.env.PORT || 8082;
app.listen(port, () => console.log(`Server running on port ${port}`));