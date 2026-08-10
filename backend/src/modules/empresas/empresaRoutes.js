const express = require('express');
const { requireAuth } = require('../auth/authMiddleware');
const empresaController = require('./empresaController');

const router = express.Router();

router.get('/', requireAuth, empresaController.list);

module.exports = router;
