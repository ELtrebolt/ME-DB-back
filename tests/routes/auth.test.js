const request = require('supertest');

jest.mock('../../config/constants', () => ({ CLIENT_URL: 'http://localhost:3000' }));

jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req, res) => res.redirect(302, 'http://localhost:3000'))
}));

const app = require('../testApp');

describe('GET /auth/health', () => {
  it('returns 200 and success', async () => {
    const res = await request(app).get('/auth/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/running/i);
  });
});

describe('GET /auth/login/failed', () => {
  it('returns 401 and failure message', async () => {
    const res = await request(app).get('/auth/login/failed');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('failure');
  });
});

describe('GET /auth/login/success', () => {
  it('returns 200 with user null when not authenticated', async () => {
    const res = await request(app).get('/auth/login/success');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with user when authenticated', async () => {
    const res = await request(app)
      .get('/auth/login/success')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.ID).toBe('user1');
    expect(res.body.success).toBe(true);
  });
});

describe('GET /auth/google', () => {
  it('redirects or returns (passport.authenticate)', async () => {
    const res = await request(app).get('/auth/google');
    expect([302, 401, 500]).toContain(res.status);
  });
});

describe('GET /auth/logout', () => {
  it('redirects to CLIENT_URL', async () => {
    const res = await request(app).get('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/localhost:3000/);
  });
});
