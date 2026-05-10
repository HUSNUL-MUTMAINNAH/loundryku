const express = require('express');
const router  = express.Router();
const {
  createOrder,
  inputWeight,
  getMyOrders,
  getAllOrders,
  getOrderDetail,
  updateOrderStatus,
  assignCourier,
  switchCourierPhase,
  trackOrder,
  rateOrder,
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// ── Customer ──────────────────────────────────────────────────────────────
router.post('/',                          authenticate, authorize('customer'), createOrder);
router.get('/my-orders',                  authenticate, authorize('customer'), getMyOrders);
router.post('/:order_id/ratings',         authenticate, authorize('customer'), rateOrder);

// ── Owner ─────────────────────────────────────────────────────────────────
router.get('/',                           authenticate, authorize('owner', 'admin'), getAllOrders);
router.patch('/:order_id/status',         authenticate, authorize('owner'), updateOrderStatus);
router.post('/:order_id/assign-courier',  authenticate, authorize('owner'), assignCourier);
router.patch('/:order_id/weight',         authenticate, authorize('owner'), inputWeight);
router.patch('/:order_id/courier-phase',  authenticate, authorize('owner'), switchCourierPhase);

// ── Shared ────────────────────────────────────────────────────────────────
router.get('/:order_id',                  authenticate, getOrderDetail);
router.get('/:order_id/tracking',         authenticate, trackOrder);

module.exports = router;
