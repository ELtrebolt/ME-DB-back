const request = require('supertest');

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(() => Promise.resolve({})),
  find: jest.fn(() => Promise.resolve([]))
}));

const User = require('../../../models/User');
const app = require('../../testApp');

describe('GET /api/friends', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/friends');
    expect(res.status).toBe(401);
  });

  it('returns friends list when authenticated', async () => {
    User.findOne.mockResolvedValue({ friends: [], friendRequests: [] });
    const res = await request(app)
      .get('/api/friends')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('friends');
  });
});

describe('GET /api/friends/requests', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/friends/requests');
    expect(res.status).toBe(401);
  });

  it('returns 200 with incoming and outgoing when authenticated', async () => {
    User.findOne.mockResolvedValue({ friendRequests: [] });
    const res = await request(app)
      .get('/api/friends/requests')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.incoming).toEqual([]);
    expect(res.body.outgoing).toEqual([]);
  });
});

describe('POST /api/friends/request/:username', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/friends/request/someuser');
    expect(res.status).toBe(401);
  });

  it('returns 200 when friend request sent successfully', async () => {
    const targetUser = { ID: 'targetId', username: 'targetuser' };
    const currentUser = { ID: 'user1', username: 'user1', friends: [], friendRequests: [] };
    User.findOne
      .mockResolvedValueOnce(targetUser)
      .mockResolvedValueOnce(currentUser);
    User.findOneAndUpdate.mockResolvedValue({});
    const res = await request(app)
      .post('/api/friends/request/targetuser')
      .set('X-Test-User-ID', 'user1')
      .set('X-Test-Username', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/sent/i);
  });
});

describe('POST /api/friends/accept/:username', () => {
  beforeEach(() => {
    User.findOne.mockReset();
    User.findOneAndUpdate.mockReset();
    if (!User.updateOne) User.updateOne = jest.fn();
    User.updateOne.mockReset();
    User.updateOne.mockResolvedValue({});
  });

  it('returns idempotent success when already friends (no double-write)', async () => {
    const senderUser = { ID: 'senderId', username: 'sender' };
    const currentUser = {
      ID: 'user1',
      friends: ['senderId'],
      friendRequests: []
    };
    User.findOne
      .mockResolvedValueOnce(senderUser)
      .mockResolvedValueOnce(currentUser);

    const res = await request(app)
      .post('/api/friends/accept/sender')
      .set('X-Test-User-ID', 'user1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyFriends).toBe(true);
    // No write should have fired.
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('uses atomic updateOne with arrayFilters for both users', async () => {
    const senderUser = { ID: 'senderId', username: 'sender' };
    const currentUser = {
      ID: 'user1',
      friends: [],
      friendRequests: [{ from: 'senderId', to: 'user1', status: 'pending' }]
    };
    User.findOne
      .mockResolvedValueOnce(senderUser)
      .mockResolvedValueOnce(currentUser);

    const res = await request(app)
      .post('/api/friends/accept/sender')
      .set('X-Test-User-ID', 'user1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(User.updateOne).toHaveBeenCalledTimes(2);
    // Both calls must include arrayFilters guarding by the pending request shape.
    for (const call of User.updateOne.mock.calls) {
      const opts = call[2];
      expect(opts).toHaveProperty('arrayFilters');
      expect(opts.arrayFilters[0]['req.status']).toBe('pending');
    }
  });

  it('returns 404 when no pending request exists and not already friends', async () => {
    const senderUser = { ID: 'senderId', username: 'sender' };
    const currentUser = { ID: 'user1', friends: [], friendRequests: [] };
    User.findOne
      .mockResolvedValueOnce(senderUser)
      .mockResolvedValueOnce(currentUser);

    const res = await request(app)
      .post('/api/friends/accept/sender')
      .set('X-Test-User-ID', 'user1');

    expect(res.status).toBe(404);
  });
});
