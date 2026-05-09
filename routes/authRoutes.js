const express = require('express');
const router  = express.Router();
const { register, login, getProfile, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login',    login);
router.get('/profile',   authenticate, getProfile);
router.post('/logout',   authenticate, logout);

module.exports = router;
