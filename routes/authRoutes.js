const express = require('express');
const router  = express.Router();
const { register, login, getProfile, logout, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login',    login);
router.get('/profile',   authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.post('/logout',   authenticate, logout);

module.exports = router;