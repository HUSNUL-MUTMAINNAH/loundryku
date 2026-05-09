const express = require('express');
const router  = express.Router();
const { updateLocation, updateTaskStatus, getMyTasks, getTaskHistory } = require('../controllers/courierController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.patch('/me/location',                    authenticate, authorize('courier'), updateLocation);
router.patch('/tasks/:assignment_id/status',    authenticate, authorize('courier'), updateTaskStatus);
router.get('/me/tasks',                         authenticate, authorize('courier'), getMyTasks);
router.get('/me/tasks/history',                 authenticate, authorize('courier'), getTaskHistory);

module.exports = router;
