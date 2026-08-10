const asyncHandler = require('../../utils/asyncHandler');
const healthService = require('./health.service');

function createHealthController({ service = healthService } = {}) {
  return {
    getHealth: asyncHandler(async (req, res) => {
      const { statusCode, body } = await service.getHealth();
      res.status(statusCode).json(body);
    })
  };
}

module.exports = createHealthController();
module.exports.createHealthController = createHealthController;
