/**
 * Normalize a single tag: lowercase, spaces to hyphens.
 * @param {string} tag - Raw tag
 * @returns {string} Normalized tag
 */
function normalizeTag(tag) {
  if (tag == null || typeof tag !== 'string') return tag;
  return tag.toLowerCase().replace(/ /g, '-');
}

module.exports = { normalizeTag };
