// routes/serviceRoutes.js
const express = require('express');
const router  = express.Router();
const { getAllServices, getServiceDetail } = require('../controllers/serviceController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/',             authenticate, getAllServices);
router.get('/:service_id',  authenticate, getServiceDetail);

module.exports = router;
