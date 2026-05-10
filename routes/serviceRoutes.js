// routes/serviceRoutes.js
const express = require('express');
const router  = express.Router();
const { getAllServices, getServiceDetail, createService, updateService, deleteService } = require('../controllers/serviceController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/',             authenticate, getAllServices);
router.get('/:service_id',  authenticate, getServiceDetail);
router.post('/',            authenticate, authorize('owner', 'admin'), createService);
router.patch('/:service_id',authenticate, authorize('owner', 'admin'), updateService);
router.delete('/:service_id',authenticate, authorize('owner', 'admin'), deleteService);

module.exports = router;