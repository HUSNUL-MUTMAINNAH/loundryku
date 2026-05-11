const express = require('express');
const router  = express.Router();
const {
  createOrder, getMyOrders, getOrderDetail,
  updateOrderStatus, assignCourier, trackOrder, rateOrder,
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Customer
router.post('/',                                authenticate, authorize('customer'), createOrder);
router.get('/my-orders',                        authenticate, authorize('customer'), getMyOrders);
router.get('/:order_id',                        authenticate, getOrderDetail);
router.get('/:order_id/tracking',               authenticate, trackOrder);
router.post('/:order_id/ratings',               authenticate, authorize('customer'), rateOrder);

// Owner
router.patch('/:order_id/status',               authenticate, authorize('owner'), updateOrderStatus);
router.post('/:order_id/assign-courier',        authenticate, authorize('owner'), assignCourier);

module.exports = router;
