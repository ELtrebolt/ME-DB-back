const request = require('supertest');

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
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
