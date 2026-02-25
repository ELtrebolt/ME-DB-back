/**
 * Build a single CSV data row from a media document (no header).
 * Escapes double quotes in title/description; formats year as ISO date; joins tags.
 * @param {object} media - Media document with title, tier, toDo, year, tags, description, mediaType
 * @returns {string} One CSV row
 */
function formatMediaRow(media) {
  const title = media.title ? `"${String(media.title).replace(/"/g, '""')}"` : '';
  const tier = media.tier || '';
  const toDo = media.toDo ? 'Yes' : 'No';
  const year = media.year ? new Date(media.year).toISOString().split('T')[0] : '';
  const tags = media.tags && media.tags.length > 0 ? `"${media.tags.join(', ')}"` : '';
  const description = media.description ? `"${String(media.description).replace(/"/g, '""')}"` : '';
  return `${media.mediaType || ''},${title},${tier},${toDo},${year},${tags},${description}`;
}

module.exports = { formatMediaRow };
