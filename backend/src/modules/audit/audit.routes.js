const express = require('express');
const { requireAuth, requireRole } = require('../auth/authMiddleware');
const validate = require('../../middlewares/validate');
const controller = require('./audit.controller');
const { listAuditSchema } = require('./audit.schemas');

const router = express.Router();
router.get('/', requireAuth, requireRole('admin'), validate(listAuditSchema), controller.list);
module.exports = router;
