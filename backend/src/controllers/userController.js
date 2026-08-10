const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await userService.registerUser(req.body);
  res.json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await userService.loginUser(req.body);
  res.json(result);
});

const list = asyncHandler(async (req, res) => {
  const result = await userService.listUsers();
  res.json(result);
});

const update = asyncHandler(async (req, res) => {
  const result = await userService.updateUser({
    id: req.params.id,
    ...req.body
  });
  res.json(result);
});

const remove = asyncHandler(async (req, res) => {
  const result = await userService.deleteUser({
    id: req.params.id,
    loggedUserId: req.user.id
  });
  res.json(result);
});

const listEstoquistas = asyncHandler(async (req, res) => {
  const result = await userService.listEstoquistas();
  res.json(result);
});

module.exports = {
  register,
  login,
  list,
  update,
  remove,
  listEstoquistas
};
