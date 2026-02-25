# ME-DB Backend

REST API for the ME-DB media-collection app. Handles auth (Google OAuth), media CRUD, user/profile, stats, share links, and friends. Session store in MongoDB; CORS and credentials configured for a separate frontend.

---

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Run Locally](#run-locally)

---

## Highlights

- **Auth:** Passport.js with Google OAuth 2.0; sessions persisted in MongoDB via `connect-mongo` (reuses Mongoose connection).
- **Environment-aware config:** `STATUS=local` vs `STATUS=deploy` drives session cookie settings (sameSite, secure, proxy) and CORS origin from `config/constants.js`.
- **API layout:** REST under `/api` (media, user, stats, share, friends) plus `/auth` for login/logout/callback; global error handler and JSON body parsing.
- **Data layer:** Mongoose models (User, Media, ShareLink); `config/db.js` handles connection and optional migration (e.g. year field normalization).

---

## Tech Stack

| Area | Choices |
|------|--------|
| Runtime | Node 20.x |
| Framework | Express 4 |
| Database | MongoDB (Mongoose) |
| Auth | Passport.js, passport-google-oauth20 |
| Session | express-session, connect-mongo |
| Cross-origin | cors (credentials, configurable origin) |

---

## Project Structure

```
ME-DB-back/
├── app.js              # Entry: DB connect, session, CORS, passport, routes
├── config/
│   ├── constants.js    # CLIENT_URL, etc.
│   ├── db.js           # Mongoose connect + optional migrations
│   └── passport.js     # Google strategy, serialize/deserialize
├── models/
│   ├── Media.js
│   ├── ShareLink.js
│   └── User.js
└── routes/
    ├── auth.js         # /auth (login, logout, callback)
    └── api/
        ├── media.js
        ├── user.js
        ├── stats.js
        ├── share.js
        └── friends.js
```

---

## Run Locally

**Prerequisites:** Node 20.x, MongoDB (e.g. local or Atlas). Set `MONGODB_URI` and ensure `CLIENT_URL` in `config/constants.js` (or env) points to the frontend (e.g. `http://localhost:3000`).

```bash
npm install
npm start
```

Default port: **8082** (or `PORT` env). Use `npm run app` for nodemon during development.

For Google OAuth, configure callback URL and credentials in your Google Cloud project and in `config/passport.js` / env as needed.
