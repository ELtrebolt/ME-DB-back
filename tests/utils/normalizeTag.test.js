const { normalizeTag } = require('../../utils/normalizeTag');

describe('normalizeTag', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(normalizeTag('Action Adventure')).toBe('action-adventure');
    expect(normalizeTag('SCI-FI')).toBe('sci-fi');
  });

  it('handles already normalized tag', () => {
    expect(normalizeTag('comedy')).toBe('comedy');
  });

  it('handles empty string', () => {
    expect(normalizeTag('')).toBe('');
  });

  it('returns original for null/undefined', () => {
    expect(normalizeTag(null)).toBe(null);
    expect(normalizeTag(undefined)).toBe(undefined);
  });
});
