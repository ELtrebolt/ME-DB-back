const request = require('supertest');

jest.mock('../../../models/Media', () => ({
  aggregate: jest.fn(() => ({ then: (fn) => fn([]), catch: (fn) => fn() })),
  find: jest.fn(() => ({ then: (fn) => fn([]), catch: (fn) => fn() })),
  findOne: jest.fn(() => ({ then: (fn) => fn(null), catch: (fn) => fn() })),
  findOneAndUpdate: jest.fn(() => ({ then: (fn) => fn({}), catch: (fn) => fn() })),
  findOneAndDelete: jest.fn(() => ({ then: (fn) => fn(null), catch: (fn) => fn() })),
  create: jest.fn(() => Promise.resolve({ title: 'Test', ID: 1 })),
  deleteMany: jest.fn(() => ({ then: (fn) => fn({ deletedCount: 0 }), catch: (fn) => fn() })),
  bulkWrite: jest.fn(() => Promise.resolve())
}));

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(() => ({
    then: (fn) => {
      const u = { ID: 'user1', movies: { total: 0 }, newTypes: null };
      fn(u);
      return { then: () => ({}), catch: () => ({}) };
    },
    catch: () => ({})
  })),
  findOneAndUpdate: jest.fn(() => ({
    lean: jest.fn(() => ({ then: (fn) => fn({ movies: { total: 1 }, newTypes: null }), catch: (fn) => fn() })),
    then: (fn) => fn({ movies: { total: 1 }, newTypes: null }),
    catch: (fn) => fn()
  }))
}));

const Media = require('../../../models/Media');
const app = require('../../testApp');

const thenable = (value) => ({ then: (fn) => fn(value), catch: () => ({ then: () => ({ catch: () => {} }) }) });

describe('GET /api/media/:mediaType/:group', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/media/movies/collection');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/auth/i);
  });

  it('returns media and uniqueTags when authenticated', async () => {
    const res = await request(app)
      .get('/api/media/movies/collection')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('media');
    expect(res.body).toHaveProperty('uniqueTags');
    expect(Array.isArray(res.body.media)).toBe(true);
  });
});

describe('POST /api/media', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/media')
      .send({ media: { mediaType: 'movies', title: 'X', tier: 'S', toDo: false } });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/media/:mediaType/:id (single item)', () => {
  it('returns 200 and media when found', async () => {
    const mockMedia = { ID: 123, title: 'X', mediaType: 'movies', tier: 'S', toDo: false };
    Media.findOne.mockReturnValue(thenable(mockMedia));
    const res = await request(app)
      .get('/api/media/movies/123')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('X');
    expect(res.body.ID).toBe(123);
  });
});

describe('PUT /api/media/:mediaType/:ID', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).put('/api/media/movies/1').send({ tier: 'A' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and updated media when successful', async () => {
    const updated = { ID: 1, title: 'Updated', tier: 'A', toDo: false };
    Media.findOneAndUpdate.mockReturnValue(thenable(updated));
    const res = await request(app)
      .put('/api/media/movies/1')
      .set('X-Test-User-ID', 'user1')
      .send({ tier: 'A' });
    expect(res.status).toBe(200);
    expect(res.body.msg).toMatch(/Updated successfully/i);
    expect(res.body.media).toBeDefined();
    expect(res.body.media.tier).toBe('A');
  });
});

describe('PUT /api/media/:mediaType/:group/:tier/reorder', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .put('/api/media/movies/collection/S/reorder')
      .send({ orderedIds: [2, 1] });
    expect(res.status).toBe(401);
  });

  it('returns 200 when reorder successful', async () => {
    Media.bulkWrite.mockResolvedValue({});
    const res = await request(app)
      .put('/api/media/movies/collection/S/reorder')
      .set('X-Test-User-ID', 'user1')
      .send({ orderedIds: [2, 1] });
    expect(res.status).toBe(200);
    expect(res.body.msg).toMatch(/Reordered/i);
  });

  it('returns 200 with no changes when orderedIds empty', async () => {
    const res = await request(app)
      .put('/api/media/movies/collection/S/reorder')
      .set('X-Test-User-ID', 'user1')
      .send({ orderedIds: [] });
    expect(res.status).toBe(200);
    expect(res.body.msg).toMatch(/No changes/i);
  });
});

describe('DELETE /api/media/:mediaType/:ID', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/media/movies/1');
    expect(res.status).toBe(401);
  });

  it('returns 200 and message when delete successful', async () => {
    Media.findOneAndDelete.mockImplementationOnce(() =>
      thenable({ title: 'Deleted Movie', toDo: false })
    );
    const res = await request(app)
      .delete('/api/media/movies/1')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.msg).toMatch(/deleted successfully/i);
    expect(res.body.toDo).toBe(false);
  });

  it('returns 404 when media not found', async () => {
    Media.findOneAndDelete.mockImplementationOnce(() => thenable(null));
    const res = await request(app)
      .delete('/api/media/movies/999')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No such a media/i);
  });
});

describe('GET /api/media/export', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/media/export');
    expect(res.status).toBe(401);
  });

  it('returns 200 and CSV with header when no media', async () => {
    Media.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(app)
      .get('/api/media/export')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.csv).toMatch(/Media Type,Title,Tier/);
  });

  it('returns 200 and CSV with row when media exists', async () => {
    const oneMedia = [{ mediaType: 'movies', title: 'T', tier: 'S', toDo: false, year: null, tags: [], description: '' }];
    Media.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(oneMedia) });
    const res = await request(app)
      .get('/api/media/export')
      .set('X-Test-User-ID', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.csv).toMatch(/movies/);
    expect(res.body.csv).toMatch(/T/);
  });
});
