const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { requireAuth, adminAuth } = require('../../middleware/auth');

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

module.exports = router;
