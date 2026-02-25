const request = require('supertest');

const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../models/ShareLink', () => {
  const ShareLink = function (data) {
    return { ...data, save: mockSave, token: (data && data.token) || 'mockedToken' };
  };
  ShareLink.findOne = jest.fn();
  ShareLink.findOneAndDelete = jest.fn();
  return ShareLink;
});

jest.mock('../../../models/Media', () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) }))
}));

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(() => Promise.resolve(null))
}));

const ShareLink = require('../../../models/ShareLink');
const app = require('../../testApp');

describe('POST /api/share', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/share')
      .send({ mediaType: 'movies', shareConfig: { collection: true, todo: false } });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid share configuration', async () => {
    const res = await request(app)
      .post('/api/share')
      .set('X-Test-User-ID', 'user1')
      .send({ mediaType: 'movies' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 200 and token when valid and no existing link', async () => {
    ShareLink.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/share')
      .set('X-Test-User-ID', 'user1')
      .send({ mediaType: 'movies', shareConfig: { collection: true, todo: false } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/share/status/:mediaType', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/share/status/movies');
    expect(res.status).toBe(401);
  });

  it('returns 200 with exists true and token when link exists', async () => {
    ShareLink.findOne.mockResolvedValue({
      token: 'abc123',
      shareConfig: { collection: true, todo: false }
    });
    const res = await request(app)
      .get('/api/share/status/movies')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.token).toBe('abc123');
  });

  it('returns 200 with exists false when no link', async () => {
    ShareLink.findOne.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/share/status/movies')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });
});

describe('GET /api/share/:token (public)', () => {
  it('returns 200 and shared data when token valid', async () => {
    const shareLink = {
      userID: 'user1',
      mediaType: 'movies',
      shareConfig: { collection: true, todo: false }
    };
    ShareLink.findOne.mockResolvedValue(shareLink);
    const res = await request(app).get('/api/share/someToken123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.media).toBeDefined();
    expect(res.body.mediaType).toBe('movies');
  });

  it('returns 404 when token not found', async () => {
    ShareLink.findOne.mockResolvedValue(null);
    const res = await request(app).get('/api/share/invalidToken');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found|expired/i);
  });
});
