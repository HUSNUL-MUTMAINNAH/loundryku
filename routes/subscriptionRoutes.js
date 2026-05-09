const express = require('express');
const router  = express.Router();
const { getPlans, buySubscription } = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/plans',  getPlans);                                      // Public
router.post('/',      authenticate, authorize('customer'), buySubscription);

module.exports = router;
