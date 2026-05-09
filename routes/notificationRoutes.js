const express = require('express');
const router  = express.Router();
const { getNotifications, markAsRead } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/',                              authenticate, getNotifications);
router.patch('/:notification_id/read',       authenticate, markAsRead);

module.exports = router;
