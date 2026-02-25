const request = require('supertest');

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(() => Promise.resolve({ newTypes: new Map(), ID: 'user1' }))
}));

jest.mock('../../../models/Media', () => ({
  find: jest.fn(() => Promise.resolve([]))
}));

const app = require('../../testApp');

describe('GET /api/stats', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('returns stats shape when authenticated', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.totals).toBeDefined();
    expect(res.body.data.typeDistribution).toBeDefined();
    expect(res.body.data.customTypes).toBeDefined();
  });
});
