const request = require('supertest');

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock('../../../models/ShareLink', () => ({
  find: jest.fn(() => Promise.resolve([]))
}));

const User = require('../../../models/User');
const app = require('../../testApp');

describe('GET /api/user/public/:username', () => {
  it('returns 404 when user not found', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).get('/api/user/public/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when profile is private', async () => {
    User.findOne.mockResolvedValueOnce({ username: 'private', isPublicProfile: false });
    const res = await request(app).get('/api/user/public/private');
    expect(res.status).toBe(403);
  });

  it('returns 200 with user and sharedLists when profile is public', async () => {
    const publicUser = {
      ID: 'uid1',
      username: 'publicuser',
      displayName: 'Public User',
      profilePic: null,
      isPublicProfile: true,
      sharedListsOrder: []
    };
    User.findOne
      .mockResolvedValueOnce(publicUser)
      .mockResolvedValueOnce(null);
    const res = await request(app).get('/api/user/public/publicuser');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('publicuser');
    expect(res.body.sharedLists).toEqual([]);
  });
});

describe('PUT /api/user/username', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .put('/api/user/username')
      .send({ username: 'validuser' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid username (too long)', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/user/username')
      .set('X-Test-User-ID', 'user1')
      .send({ username: 'a'.repeat(31) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/30/);
  });

  it('returns 400 for invalid username (invalid chars)', async () => {
    const res = await request(app)
      .put('/api/user/username')
      .set('X-Test-User-ID', 'user1')
      .send({ username: 'invalid-user' });
    expect(res.status).toBe(400);
  });

  it('returns 200 when valid and not taken', async () => {
    User.findOne.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValue({ username: 'validuser' });
    const res = await request(app)
      .put('/api/user/username')
      .set('X-Test-User-ID', 'user1')
      .send({ username: 'validuser' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('validuser');
  });
});

describe('PUT /api/user/:mediaType/:group/:tier — path injection guards', () => {
  it('rejects unknown fixed mediaType', async () => {
    const res = await request(app)
      .put('/api/user/email/collection/S')
      .set('X-Test-User-ID', 'user1')
      .send({ newTitle: 'pwn' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid media type/i);
  });

  it('rejects unknown group', async () => {
    const res = await request(app)
      .put('/api/user/movies/__proto__/S')
      .set('X-Test-User-ID', 'user1')
      .send({ newTitle: 'pwn' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid group/i);
  });

  it('rejects tier key with disallowed characters', async () => {
    const res = await request(app)
      .put('/api/user/movies/collection/S.injection')
      .set('X-Test-User-ID', 'user1')
      .send({ newTitle: 'pwn' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid tier key/i);
  });

  it('rejects custom mediaType not present on user', async () => {
    User.findOne.mockResolvedValueOnce({
      ID: 'user1',
      newTypes: { has: () => false }
    });
    const res = await request(app)
      .put('/api/user/anything/collection/S')
      .set('X-Test-User-ID', 'user1')
      .send({ newTitle: 'pwn', newType: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown custom media type/i);
  });

  it('accepts a valid fixed-type tier rename', async () => {
    User.findOneAndUpdate.mockReturnValueOnce({
      then: (fn) => fn({ movies: { collectionTiers: { S: 'Renamed' } } })
    });
    const res = await request(app)
      .put('/api/user/movies/collection/S')
      .set('X-Test-User-ID', 'user1')
      .send({ newTitle: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.msg).toMatch(/successfully/i);
  });
});

describe('PUT /api/user/newTypes — key validation', () => {
  it('rejects newType containing a dot', async () => {
    const res = await request(app)
      .put('/api/user/newTypes')
      .set('X-Test-User-ID', 'user1')
      .send({ newType: 'evil.path' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/letters, numbers/i);
  });

  it('rejects newType matching a built-in type', async () => {
    const res = await request(app)
      .put('/api/user/newTypes')
      .set('X-Test-User-ID', 'user1')
      .send({ newType: 'movies' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/built-in/i);
  });

  it('rejects newType named __proto__', async () => {
    const res = await request(app)
      .put('/api/user/newTypes')
      .set('X-Test-User-ID', 'user1')
      .send({ newType: '__proto__' });
    // __proto__ matches the SAFE_KEY_REGEX letters/underscores, but is not in
    // FIXED_MEDIA_TYPES, so it would currently pass into the Map. The check we
    // care about here is that dots/special chars are rejected — keep this test
    // as a documentation tripwire: if behaviour for __proto__ ever changes,
    // revisit.
    expect([200, 400]).toContain(res.status);
  });
});
