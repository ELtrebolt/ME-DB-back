jest.mock('../../models/User', () => ({
  findOneAndUpdate: jest.fn(),
}));

const User = require('../../models/User');
const { requireAuth, adminAuth } = require('../../middleware/auth');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findOneAndUpdate.mockReturnValue({ catch: jest.fn() });
  });

  it('returns 401 when req.user is missing', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/auth/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next without touching DB when lastActiveAt is fresh', () => {
    const recent = new Date();
    const req = { user: { ID: 'u1', lastActiveAt: recent } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('updates lastActiveAt when stale and then calls next', () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const req = { user: { ID: 'u1', lastActiveAt: old } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { ID: 'u1' },
      { $set: { lastActiveAt: expect.any(Date) } }
    );
    expect(req.user.lastActiveAt).toBeInstanceOf(Date);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when lastActiveAt is missing', () => {
    const req = { user: { ID: 'u1' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(User.findOneAndUpdate).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('adminAuth', () => {
  const prevAdmin = process.env.ADMIN_EMAILS;

  afterAll(() => {
    process.env.ADMIN_EMAILS = prevAdmin;
  });

  it('returns 403 when user has no email on allow list', () => {
    process.env.ADMIN_EMAILS = 'boss@co.test';
    const req = { user: { ID: 'u1', email: 'other@x.com' } };
    const res = mockRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user email is admin', () => {
    process.env.ADMIN_EMAILS = 'boss@co.test, deputy@co.test';
    const req = { user: { ID: 'u1', email: 'deputy@co.test' } };
    const res = mockRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user is missing', () => {
    process.env.ADMIN_EMAILS = 'boss@co.test';
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
