const express = require('express');
const { requireAuth, requireRole } = require('../auth/authMiddleware');
const validate = require('../../middlewares/validate');
const empresaController = require('./empresaController');
const { listEmpresasSchema, createEmpresaSchema, updateEmpresaSchema, updateEmpresaStatusSchema } = require('./empresaSchemas');

const router = express.Router();

router.get('/', requireAuth, validate(listEmpresasSchema), empresaController.listActive);
router.get('/admin', requireAuth, requireRole('admin'), validate(listEmpresasSchema), empresaController.list);
router.post('/', requireAuth, requireRole('admin'), validate(createEmpresaSchema), empresaController.create);
router.put('/:id', requireAuth, requireRole('admin'), validate(updateEmpresaSchema), empresaController.update);
router.patch('/:id/status', requireAuth, requireRole('admin'), validate(updateEmpresaStatusSchema), empresaController.updateStatus);

module.exports = router;
