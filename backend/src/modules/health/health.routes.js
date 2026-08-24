const express = require('express');
const healthController = require('./health.controller');

function createHealthRoutes({ controller = healthController } = {}) {
  const router = express.Router();

  router.get('/health', controller.getHealth);
  router.get('/health/live', controller.getLiveness);
  router.get('/health/ready', controller.getReadiness);

  return router;
}

module.exports = createHealthRoutes();
module.exports.createHealthRoutes = createHealthRoutes;
