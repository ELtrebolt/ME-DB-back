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
