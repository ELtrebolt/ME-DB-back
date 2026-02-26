const User = require('../models/User');

async function generateUniqueUsername(displayName) {
  const base = (displayName || '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .slice(0, 24) || 'User';

  if (!await User.exists({ username: base })) return base;

  for (let i = 0; i < 5; i++) {
    const suffix = Math.floor(Math.random() * 900) + 100;
    const candidate = `${base}_${suffix}`;
    if (!await User.exists({ username: candidate })) return candidate;
  }

  return `User_${Date.now()}`;
}

module.exports = generateUniqueUsername;
