const express = require('express');
const router  = express.Router();
const { getDashboardMetrics, verifyUser } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/dashboard/metrics',       authenticate, authorize('admin'), getDashboardMetrics);
router.patch('/users/:user_id/verify', authenticate, authorize('admin'), verifyUser);

module.exports = router;
