const env = require('../../config/env');
const healthRepository = require('./health.repository');

function createHealthService({ repository = healthRepository, config = env } = {}) {
  async function getDatabaseHealth() {
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

  return {
    async getHealth() {
      return getDatabaseHealth();
    },

    async getLiveness() {
      return { statusCode: 200, body: { status: 'ok' } };
    },

    async getReadiness() {
      return getDatabaseHealth();
    }
  };
}

module.exports = createHealthService();
module.exports.createHealthService = createHealthService;
