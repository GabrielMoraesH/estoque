const env = require('./config/env');
const app = require('./app');
const pool = require('./config/db');
const logger = require('./utils/logger');
const { createLifecycle, registerLifecycleHandlers } = require('./lifecycle');

async function startServer() {
  try {
    await pool.query('SELECT 1');
    logger.info(`[startup] Banco conectado em ${env.db.host}:${env.db.port}/${env.db.name}`);

    const server = app.listen(env.port, () => {
      logger.info(`[startup] API rodando em http://localhost:${env.port} (${env.nodeEnv})`);
    });

    const lifecycle = createLifecycle({ server, pool, logger });
    registerLifecycleHandlers({ server, pool, lifecycle });

    return server;
  } catch (error) {
    logger.error('[startup] Falha ao iniciar o backend', error.message);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
