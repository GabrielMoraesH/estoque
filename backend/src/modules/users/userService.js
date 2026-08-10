const auditService = require('../audit/auditService');
const userRepository = require('./user.repository');
const { createUserService } = require('./user.service');

const userService = createUserService({
  repository: userRepository,
  audit: auditService
});

module.exports = userService;
module.exports.createUserService = createUserService;
