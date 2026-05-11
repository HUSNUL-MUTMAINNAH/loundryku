const express = require('express');
const router  = express.Router();
const { createPayment, paymentCallback } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/',          authenticate, createPayment);
router.post('/callback',  paymentCallback); // Tidak pakai auth, dipanggil payment gateway

module.exports = router;
