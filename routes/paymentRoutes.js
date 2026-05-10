const express = require('express');
const router  = express.Router();
const { createPayment, paymentCallback, getInvoiceDetail } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/',                           authenticate, createPayment);
router.post('/callback',                   paymentCallback);            // dipanggil payment gateway, tanpa auth
router.get('/invoice/:invoice_id',         authenticate, getInvoiceDetail);

module.exports = router;
