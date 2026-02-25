/**
 * Escape regex special characters for safe use in RegExp.
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
