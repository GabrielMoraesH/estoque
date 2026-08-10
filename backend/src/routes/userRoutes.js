const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validate');
const userController = require('../controllers/userController');
const {
  registerUserSchema,
  loginSchema,
  listUsersSchema,
  updateUserSchema,
  deleteUserSchema,
  listEstoquistasSchema
} = require('../validators/userSchemas');

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  next();
}

router.post('/register', authMiddleware, requireAdmin, validateRequest(registerUserSchema), userController.register);
router.post('/login', validateRequest(loginSchema), userController.login);
router.get('/', authMiddleware, requireAdmin, validateRequest(listUsersSchema), userController.list);
router.put('/:id', authMiddleware, requireAdmin, validateRequest(updateUserSchema), userController.update);
router.delete('/:id', authMiddleware, requireAdmin, validateRequest(deleteUserSchema), userController.remove);
router.get('/estoquistas', authMiddleware, validateRequest(listEstoquistasSchema), userController.listEstoquistas);

module.exports = router;
