const env = require('../../config/env');
const healthRepository = require('./health.repository');

function createHealthService({ repository = healthRepository, config = env } = {}) {
  return {
    async getHealth() {
      const health = {
        status: 'ok',
        environment: config.nodeEnv,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: 'ok'
        }
      };

      try {
        await repository.pingDatabase();
        return { statusCode: 200, body: health };
      } catch (error) {
        return {
          statusCode: 503,
          body: {
            ...health,
            status: 'degraded',
            database: {
              status: 'error'
            }
          }
        };
      }
    }
  };
}

module.exports = createHealthService();
module.exports.createHealthService = createHealthService;
