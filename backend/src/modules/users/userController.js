const userService = require('./userService');
const asyncHandler = require('../../utils/asyncHandler');
const { getRequestContext } = require('../../utils/requestContext');

function createUserController({ service = userService } = {}) {
  return {
    register: asyncHandler(async (req, res) => {
      const result = await service.registerUser({
        ...req.body,
        actor: req.user,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    login: asyncHandler(async (req, res) => {
      const result = await service.loginUser(req.body);
      res.json(result);
    }),

    list: asyncHandler(async (req, res) => {
      const result = await service.listUsers();
      res.json(result);
    }),

    update: asyncHandler(async (req, res) => {
      const result = await service.updateUser({
        id: req.params.id,
        ...req.body,
        actor: req.user,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    updateStatus: asyncHandler(async (req, res) => {
      const result = await service.updateUserStatus({
        id: req.params.id,
        ativo: req.body.ativo,
        actor: req.user,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    remove: asyncHandler(async (req, res) => {
      const result = await service.deleteUser({
        id: req.params.id,
        loggedUserId: req.user.id,
        actor: req.user,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    listEstoquistas: asyncHandler(async (req, res) => {
      const result = await service.listEstoquistas({
        empresaId: req.empresaId
      });
      res.json(result);
    })
  };
}

module.exports = createUserController();
module.exports.createUserController = createUserController;
