const { escapeRegex } = require('../../utils/escapeRegex');

describe('escapeRegex', () => {
  it('escapes regex special characters', () => {
    expect(escapeRegex('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('returns safe string for use in RegExp', () => {
    const userInput = 'user (name)';
    const regex = new RegExp(`^${escapeRegex(userInput)}$`, 'i');
    expect(regex.test('user (name)')).toBe(true);
    expect(regex.test('user (name) extra')).toBe(false);
  });

  it('leaves normal alphanumeric unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello');
    expect(escapeRegex('user123')).toBe('user123');
  });

  it('handles empty string', () => {
    expect(escapeRegex('')).toBe('');
  });
});
