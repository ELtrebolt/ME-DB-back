const request = require('supertest');

jest.mock('../../../models/WebVital', () => ({
  insertMany: jest.fn(() => Promise.resolve()),
  aggregate: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../../models/User', () => ({
  countDocuments: jest.fn(() => Promise.resolve(2)),
  aggregate: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(() => ({
    catch: jest.fn(),
  })),
}));

const WebVital = require('../../../models/WebVital');
const User = require('../../../models/User');
const app = require('../../testApp');

describe('POST /api/admin/vitals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 204 and persists valid LCP entry', async () => {
    const res = await request(app)
      .post('/api/admin/vitals')
      .send({ name: 'LCP', value: 1200, rating: 'good', route: '/stats' });
    expect(res.status).toBe(204);
    expect(WebVital.insertMany).toHaveBeenCalled();
    const docs = WebVital.insertMany.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('LCP');
    expect(docs[0].value).toBe(1200);
  });

  it('returns 204 without insertMany when no valid metrics', async () => {
    const res = await request(app)
      .post('/api/admin/vitals')
      .send({ name: 'INVALID', value: 1 });
    expect(res.status).toBe(204);
    expect(WebVital.insertMany).not.toHaveBeenCalled();
  });

  it('accepts array body and caps at 10 entries', async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      name: 'CLS',
      value: i,
      rating: 'good',
    }));
    const res = await request(app).post('/api/admin/vitals').send(entries);
    expect(res.status).toBe(204);
    expect(WebVital.insertMany).toHaveBeenCalled();
    expect(WebVital.insertMany.mock.calls[0][0]).toHaveLength(10);
  });
});

describe('GET /api/admin/stats', () => {
  const adminEmail = 'admin@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = adminEmail;
    User.countDocuments.mockResolvedValue(5);
    User.aggregate.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not admin', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Test-User-ID', 'u1')
      .set('X-Test-User-Email', 'user@example.com');
    expect(res.status).toBe(403);
  });

  it('returns 200 with aggregates when admin', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Test-User-ID', 'admin-id')
      .set('X-Test-User-Email', adminEmail);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalUsers).toBe(5);
    expect(res.body).toHaveProperty('dailyActiveUsers');
  });
});

describe('GET /api/admin/users', () => {
  const adminEmail = 'admin@example.com';

  beforeEach(() => {
    process.env.ADMIN_EMAILS = adminEmail;
    User.countDocuments.mockResolvedValue(1);
    User.aggregate.mockResolvedValue([
      { displayName: 'A', email: 'a@x.com', totalRecords: 3 },
    ]);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('X-Test-User-ID', 'u1')
      .set('X-Test-User-Email', 'x@y.com');
    expect(res.status).toBe(403);
  });

  it('returns paginated users for admin', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=1')
      .set('X-Test-User-ID', 'admin-id')
      .set('X-Test-User-Email', adminEmail);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].displayName).toBe('A');
  });
});

describe('GET /api/admin/perf', () => {
  const adminEmail = 'admin@example.com';

  beforeEach(() => {
    process.env.ADMIN_EMAILS = adminEmail;
    WebVital.aggregate.mockResolvedValue([]);
  });

  it('returns perf payload for admin', async () => {
    const res = await request(app)
      .get('/api/admin/perf?range=7')
      .set('X-Test-User-ID', 'admin-id')
      .set('X-Test-User-Email', adminEmail);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('current');
    expect(res.body).toHaveProperty('previous');
    expect(res.body).toHaveProperty('trends');
    expect(WebVital.aggregate).toHaveBeenCalled();
  });
});
