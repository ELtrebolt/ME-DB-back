/**
 * Validate username: trim, length <= 30, alphanumeric and underscores, must start with letter or number.
 * @param {string} username - Raw username
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username cannot be empty' };
  }
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be 30 characters or less' };
  }
  const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_]*$/;
  if (!usernameRegex.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or number' };
  }
  return { valid: true };
}

module.exports = { validateUsername };
