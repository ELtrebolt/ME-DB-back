/**
 * Integration tests with in-memory MongoDB.
 * Skipped if MongoMemoryServer fails to start (e.g. missing vc_redist on Windows).
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const Media = require('../../models/Media');

let mongoServer;
let app;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = require('../testApp');
  } catch (err) {
    console.warn('MongoMemoryServer failed to start, skipping integration tests:', err.message);
    mongoServer = null;
  }
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function ensureTestUser() {
  let user = await User.findOne({ ID: 'integration-user' });
  if (!user) {
    user = await User.create({
      ID: 'integration-user',
      displayName: 'Integration Test',
      username: 'integrationtest'
    });
  }
  return user;
}

describe('Integration: API with in-memory DB', () => {
  beforeAll(async () => {
    if (!mongoServer) return;
    await User.deleteMany({});
    await Media.deleteMany({});
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
          toDo: false
        }
      });
    expect(createRes.status).toBe(200);
    expect(createRes.body.ID).toBeDefined();

    const listRes = await request(app)
      .get('/api/media/movies/collection')
      .set('X-Test-User-ID', userId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.media).toBeDefined();
    expect(listRes.body.media.some(m => m.title === 'Integration Movie')).toBe(true);
  });
});
