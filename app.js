// Imports
const connectDB = require('./config/db');

const cookieSession = require("cookie-session");
const express = require("express");
const cors = require("cors");
const passportSetup = require("./passport");  // needed otherwise Unknown authentication strategy "google"
const passport = require("passport");
const authRoute = require("./routes/auth");
const media = require('./routes/api/media');
const constants = require('./config/constants');

const app = express();
connectDB();

app.use(
    cookieSession({ name: "session", keys: ["lama"], maxAge: 24 * 60 * 60 * 100 })
  );
app.use(passport.initialize());
app.use(passport.session());

app.use(
cors({
    origin: constants['CLIENT_URL'],    // true
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
}));

// Middleware to parse JSON data
app.use(express.json());

// use Routes
app.use('/api/media', media);
app.use('/auth', authRoute);

const port = process.env.PORT || 8082;
app.listen(port, () => console.log(`Server running on port ${port}`));