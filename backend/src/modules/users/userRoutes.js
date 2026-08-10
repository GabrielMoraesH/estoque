const express = require('express');
const { requireAuth, requireRole } = require('../auth/authMiddleware');
const requireActiveEmpresa = require('../../middlewares/activeEmpresa');
const validate = require('../../middlewares/validate');
const userController = require('./userController');
const {
  registerUserSchema,
  loginSchema,
  listUsersSchema,
  updateUserSchema,
  updateUserStatusSchema,
  deleteUserSchema,
  listEstoquistasSchema
} = require('./userSchemas');

const router = express.Router();

router.post('/register', requireAuth, requireRole('admin'), validate(registerUserSchema), userController.register);
router.post('/login', validate(loginSchema), userController.login);
router.get('/', requireAuth, requireRole('admin'), validate(listUsersSchema), userController.list);
router.patch('/:id/status', requireAuth, requireRole('admin'), validate(updateUserStatusSchema), userController.updateStatus);
router.put('/:id', requireAuth, requireRole('admin'), validate(updateUserSchema), userController.update);
router.delete('/:id', requireAuth, requireRole('admin'), validate(deleteUserSchema), userController.remove);
router.get('/estoquistas', requireAuth, requireActiveEmpresa, validate(listEstoquistasSchema), userController.listEstoquistas);

module.exports = router;
