/**
 * Integration tests with in-memory MongoDB.
 * On local Windows without VC++ redistributables, MongoMemoryServer may fail; tests no-op with a warning.
 * In GitHub Actions (GITHUB_ACTIONS=true), failure to start MongoMemoryServer fails the run so skips are not silent in CI.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const Media = require('../../models/Media');
const ShareLink = require('../../models/ShareLink');

let mongoServer;
let app;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = require('../testApp');
  } catch (err) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw err;
    }
    console.warn('MongoMemoryServer failed to start, skipping integration tests:', err.message);
    console.warn(
      'On Windows, install the latest VC++ redistributable if you need these tests locally:',
      'https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist'
    );
    mongoServer = null;
  }
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function ensureTestUser(overrides = {}) {
  const defaults = {
    ID: 'integration-user',
    displayName: 'Integration Test',
    username: 'integrationtest',
  };
  const id = overrides.ID || defaults.ID;
  let user = await User.findOne({ ID: id });
  if (!user) {
    user = await User.create({ ...defaults, ...overrides });
  }
  return user;
}

describe('Integration: API with in-memory DB', () => {
  beforeAll(async () => {
    if (!mongoServer) return;
    await User.deleteMany({});
    await Media.deleteMany({});
    await ShareLink.deleteMany({});
  });

  it('POST /api/media and GET list (authenticated)', async () => {
    if (!mongoServer) return;
    const user = await ensureTestUser();
    const userId = user.ID;

    const createRes = await request(app)
      .post('/api/media')
      .set('X-Test-User-ID', userId)
      .send({
        media: {
          mediaType: 'movies',
          title: 'Integration Movie',
          tier: 'S',
          toDo: false,
        },
      });
    expect(createRes.status).toBe(200);
    expect(createRes.body.ID).toBeDefined();

    const listRes = await request(app)
      .get('/api/media/movies/collection')
      .set('X-Test-User-ID', userId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.media).toBeDefined();
    expect(listRes.body.media.some((m) => m.title === 'Integration Movie')).toBe(true);
  });

  it('PUT /api/media updates title and GET reflects change', async () => {
    if (!mongoServer) return;
    const user = await ensureTestUser({
      ID: 'integration-put-user',
      username: 'integrationput',
      displayName: 'Put Test',
    });

    const createRes = await request(app)
      .post('/api/media')
      .set('X-Test-User-ID', user.ID)
      .send({
        media: {
          mediaType: 'movies',
          title: 'Before',
          tier: 'A',
          toDo: false,
        },
      });
    expect(createRes.status).toBe(200);
    const mediaId = createRes.body.ID;

    const putRes = await request(app)
      .put(`/api/media/movies/${mediaId}`)
      .set('X-Test-User-ID', user.ID)
      .send({ title: 'After' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.media.title).toBe('After');

    const listRes = await request(app)
      .get('/api/media/movies/collection')
      .set('X-Test-User-ID', user.ID);
    expect(listRes.status).toBe(200);
    expect(listRes.body.media.some((m) => m.title === 'After')).toBe(true);
  });

  it('DELETE /api/media removes item', async () => {
    if (!mongoServer) return;
    const user = await ensureTestUser({
      ID: 'integration-del-user',
      username: 'integrationdel',
      displayName: 'Delete Test',
    });

    const createRes = await request(app)
      .post('/api/media')
      .set('X-Test-User-ID', user.ID)
      .send({
        media: {
          mediaType: 'movies',
          title: 'To Delete',
          tier: 'B',
          toDo: false,
        },
      });
    expect(createRes.status).toBe(200);
    const mediaId = createRes.body.ID;

    const delRes = await request(app)
      .delete(`/api/media/movies/${mediaId}`)
      .set('X-Test-User-ID', user.ID);
    expect(delRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/media/movies/collection')
      .set('X-Test-User-ID', user.ID);
    expect(listRes.status).toBe(200);
    expect(listRes.body.media.some((m) => m.title === 'To Delete')).toBe(false);
  });

  it('POST /api/share and GET /api/share/user/:username/:mediaType (public)', async () => {
    if (!mongoServer) return;
    const user = await ensureTestUser({
      ID: 'integration-share-user',
      username: 'shareowner',
      displayName: 'Share Owner',
      isPublicProfile: true,
      movies: { total: 0 },
    });

    const createRes = await request(app)
      .post('/api/media')
      .set('X-Test-User-ID', user.ID)
      .send({
        media: {
          mediaType: 'movies',
          title: 'Shared Flick',
          tier: 'S',
          toDo: false,
        },
      });
    expect(createRes.status).toBe(200);

    const shareRes = await request(app)
      .post('/api/share')
      .set('X-Test-User-ID', user.ID)
      .send({
        mediaType: 'movies',
        shareConfig: { collection: true, todo: false },
      });
    expect(shareRes.status).toBe(200);
    expect(shareRes.body.token).toBeDefined();

    const publicRes = await request(app).get('/api/share/user/shareowner/movies');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.success).toBe(true);
    expect(publicRes.body.media.some((m) => m.title === 'Shared Flick')).toBe(true);
  });

  it('friend request and accept', async () => {
    if (!mongoServer) return;
    await User.create({
      ID: 'integration-alice',
      username: 'intalice',
      displayName: 'Alice',
      friends: [],
      friendRequests: [],
    });
    await User.create({
      ID: 'integration-bob',
      username: 'intbob',
      displayName: 'Bob',
      friends: [],
      friendRequests: [],
    });

    const reqRes = await request(app)
      .post('/api/friends/request/intbob')
      .set('X-Test-User-ID', 'integration-alice')
      .set('X-Test-Username', 'intalice');
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.success).toBe(true);

    const acceptRes = await request(app)
      .post('/api/friends/accept/intalice')
      .set('X-Test-User-ID', 'integration-bob')
      .set('X-Test-Username', 'intbob');
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    const friendsRes = await request(app)
      .get('/api/friends')
      .set('X-Test-User-ID', 'integration-alice')
      .set('X-Test-Username', 'intalice');
    expect(friendsRes.status).toBe(200);
    expect(friendsRes.body.friends.some((f) => f.username === 'intbob')).toBe(true);
  });
});
