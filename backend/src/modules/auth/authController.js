const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./authService');

function createAuthController({ service = authService } = {}) {
  return {
    getProtectedSession: asyncHandler(async (req, res) => {
      const result = service.getProtectedSession(req.user);
      res.json(result);
    }),

    getCurrentUser: asyncHandler(async (req, res) => {
      res.json({ user: service.getCurrentUser(req.user) });
    })
  };
}

module.exports = createAuthController();
module.exports.createAuthController = createAuthController;
