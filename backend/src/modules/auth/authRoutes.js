const express = require('express');
const authController = require('./authController');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();

router.get('/protegido', requireAuth, authController.getProtectedSession);
router.get('/auth/me', requireAuth, authController.getCurrentUser);

module.exports = router;
