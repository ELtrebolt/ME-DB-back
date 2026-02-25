const ShareLink = require('../../models/ShareLink');

describe('ShareLink model', () => {
  it('defaults shareConfig.collection and shareConfig.todo to false', () => {
    const link = new ShareLink({
      token: 'abc123',
      userID: 'user1',
      mediaType: 'movies'
    });
    expect(link.shareConfig.collection).toBe(false);
    expect(link.shareConfig.todo).toBe(false);
  });

  it('requires token, userID, mediaType', async () => {
    const link = new ShareLink({});
    await expect(link.validate()).rejects.toThrow();
  });

  it('stores shareConfig when provided', () => {
    const link = new ShareLink({
      token: 'def456',
      userID: 'user1',
      mediaType: 'tv',
      shareConfig: { collection: true, todo: false }
    });
    expect(link.shareConfig.collection).toBe(true);
    expect(link.shareConfig.todo).toBe(false);
  });
});
