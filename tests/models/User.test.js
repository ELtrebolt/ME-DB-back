const User = require('../../models/User');

describe('User model', () => {
  it('defaults isPublicProfile to false', () => {
    const user = new User({
      ID: 'id1',
      displayName: 'Test User',
      username: 'testuser'
    });
    expect(user.isPublicProfile).toBe(false);
  });

  it('defaults sharedListsOrder to empty array', () => {
    const user = new User({
      ID: 'id1',
      displayName: 'Test',
      username: 'user1'
    });
    expect(user.sharedListsOrder).toEqual([]);
  });

  it('defaults friends to empty array', () => {
    const user = new User({
      ID: 'id1',
      displayName: 'Test',
      username: 'user2'
    });
    expect(user.friends).toEqual([]);
  });

  it('requires ID, displayName, username', async () => {
    const user = new User({});
    await expect(user.validate()).rejects.toThrow();
  });
});
