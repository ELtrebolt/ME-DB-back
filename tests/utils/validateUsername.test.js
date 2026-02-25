const { validateUsername } = require('../../utils/validateUsername');

describe('validateUsername', () => {
  it('returns valid for alphanumeric and underscores', () => {
    expect(validateUsername('user')).toEqual({ valid: true });
    expect(validateUsername('user_123')).toEqual({ valid: true });
    expect(validateUsername('User99')).toEqual({ valid: true });
  });

  it('trims whitespace and validates', () => {
    expect(validateUsername('  ab  ')).toEqual({ valid: true });
  });

  it('rejects empty or whitespace-only', () => {
    expect(validateUsername('')).toEqual({ valid: false, error: 'Username cannot be empty' });
    expect(validateUsername('   ')).toEqual({ valid: false, error: 'Username cannot be empty' });
    expect(validateUsername(null)).toEqual({ valid: false, error: 'Username cannot be empty' });
    expect(validateUsername(undefined)).toEqual({ valid: false, error: 'Username cannot be empty' });
  });

  it('rejects over 30 characters', () => {
    const long = 'a'.repeat(31);
    expect(validateUsername(long)).toEqual({ valid: false, error: 'Username must be 30 characters or less' });
    expect(validateUsername('a'.repeat(30))).toEqual({ valid: true });
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('user-name')).toEqual({
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or number'
    });
    expect(validateUsername('user name')).toEqual({
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or number'
    });
    expect(validateUsername('_user')).toEqual({
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or number'
    });
  });
});
