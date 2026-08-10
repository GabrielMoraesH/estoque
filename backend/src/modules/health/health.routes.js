const express = require('express');
const healthController = require('./health.controller');

function createHealthRoutes({ controller = healthController } = {}) {
  const router = express.Router();

  router.get('/health', controller.getHealth);

  return router;
}

module.exports = createHealthRoutes();
module.exports.createHealthRoutes = createHealthRoutes;
