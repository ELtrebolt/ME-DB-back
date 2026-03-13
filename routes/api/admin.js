const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../../models/User');
const WebVital = require('../../models/WebVital');
const { requireAuth, adminAuth } = require('../../middleware/auth');

// @route POST /api/admin/vitals
// @description Receive web-vitals metrics from any user (sampled on the client)
// @access Public (no auth — metrics come from all visitors)
const vitalsLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const vitalsBodyParser = express.json({ type: ['application/json', 'text/plain'] });

router.post('/vitals', vitalsLimiter, vitalsBodyParser, async (req, res) => {
  try {
    const VALID = ['LCP', 'CLS', 'INP', 'TTFB'];
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    const docs = entries
      .filter(e => VALID.includes(e.name) && typeof e.value === 'number')
      .slice(0, 10)
      .map(e => ({
        name: e.name,
        value: e.value,
        rating: e.rating,
        route: (e.route || '/').substring(0, 100),
        timestamp: new Date(),
      }));
    if (docs.length) await WebVital.insertMany(docs);
    res.status(204).end();
  } catch (err) {
    console.error('Error saving web vitals:', err);
    res.status(500).end();
  }
});

router.use(requireAuth);
router.use(adminAuth);

// @route GET /api/admin/stats?range=7|30|90
// @description Get aggregated user metrics for the admin dashboard
// @access Admin only
router.get('/stats', async (req, res) => {
  try {
    const range = parseInt(req.query.range) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const [
      totalUsers,
      dailyActiveUsersRaw,
      monthlyActiveUsersRaw,
      newSignupsPerDayRaw
    ] = await Promise.all([
      User.countDocuments(),

      User.aggregate([
        { $match: { lastActiveAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActiveAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      User.aggregate([
        { $match: { lastActiveAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$lastActiveAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      success: true,
      totalUsers,
      dailyActiveUsers: dailyActiveUsersRaw.map(d => ({ date: d._id, count: d.count })),
      monthlyActiveUsers: monthlyActiveUsersRaw.map(d => ({ month: d._id, count: d.count })),
      newSignupsPerDay: newSignupsPerDayRaw.map(d => ({ date: d._id, count: d.count }))
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// @route GET /api/admin/users?page=1&sort=lastActiveAt&order=desc
// @description Get paginated list of all users (name, email, dates, total records)
// @access Admin only
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const skip = (page - 1) * limit;
    const validSortFields = ['lastActiveAt', 'createdAt', 'totalRecords'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'lastActiveAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.aggregate([
        {
          $addFields: {
            totalRecords: {
              $add: [
                { $ifNull: ['$movies.total', 0] },
                { $ifNull: ['$tv.total', 0] },
                { $ifNull: ['$anime.total', 0] },
                { $ifNull: ['$games.total', 0] },
                {
                  $reduce: {
                    input: { $objectToArray: { $ifNull: ['$newTypes', {}] } },
                    initialValue: 0,
                    in: { $add: ['$$value', { $ifNull: ['$$this.v.total', 0] }] }
                  }
                }
              ]
            }
          }
        },
        { $sort: { [sortField]: sortOrder } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            displayName: 1,
            email: 1,
            lastActiveAt: 1,
            createdAt: 1,
            totalRecords: 1
          }
        }
      ]),
      User.countDocuments()
    ]);

    res.json({
      success: true,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// @route GET /api/admin/perf?range=7|30|90
// @description Get aggregated web-vitals performance metrics with previous-period comparison
// @access Admin only
router.get('/perf', async (req, res) => {
  try {
    const range = parseInt(req.query.range) || 7;
    const since = new Date();
    since.setDate(since.getDate() - range);
    const prevStart = new Date(since);
    prevStart.setDate(prevStart.getDate() - range);

    const [current, previous, trends] = await Promise.all([
      WebVital.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $sort: { value: 1 } },
        { $group: {
            _id: { name: '$name', route: '$route' },
            values: { $push: '$value' },
            count: { $sum: 1 },
            avg: { $avg: '$value' },
        }},
        { $project: {
            name: '$_id.name', route: '$_id.route', count: 1, avg: 1,
            p50: { $arrayElemAt: ['$values', { $floor: { $multiply: [{ $size: '$values' }, 0.5] } }] },
            p75: { $arrayElemAt: ['$values', { $floor: { $multiply: [{ $size: '$values' }, 0.75] } }] },
            p95: { $arrayElemAt: ['$values', { $floor: { $multiply: [{ $size: '$values' }, 0.95] } }] },
        }},
      ]),
      WebVital.aggregate([
        { $match: { timestamp: { $gte: prevStart, $lt: since } } },
        { $sort: { value: 1 } },
        { $group: {
            _id: { name: '$name', route: '$route' },
            values: { $push: '$value' },
            count: { $sum: 1 },
            avg: { $avg: '$value' },
        }},
        { $project: {
            name: '$_id.name', route: '$_id.route', count: 1, avg: 1,
            p75: { $arrayElemAt: ['$values', { $floor: { $multiply: [{ $size: '$values' }, 0.75] } }] },
        }},
      ]),
      WebVital.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $sort: { value: 1 } },
        { $group: {
            _id: {
              name: '$name',
              day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            },
            values: { $push: '$value' },
        }},
        { $project: {
            name: '$_id.name', day: '$_id.day',
            p75: { $arrayElemAt: ['$values', { $floor: { $multiply: [{ $size: '$values' }, 0.75] } }] },
        }},
        { $sort: { day: 1 } },
      ]),
    ]);

    res.json({ success: true, current, previous, trends });
  } catch (err) {
    console.error('Error fetching perf stats:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
