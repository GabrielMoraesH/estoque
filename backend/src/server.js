const env = require('./config/env');
const app = require('./app');
const pool = require('./config/db');
const logger = require('./utils/logger');

async function startServer() {
  try {
    await pool.query('SELECT 1');
    logger.info(`[startup] Banco conectado em ${env.db.host}:${env.db.port}/${env.db.name}`);

    const server = app.listen(env.port, () => {
      logger.info(`[startup] API rodando em http://localhost:${env.port} (${env.nodeEnv})`);
    });

    const shutdown = (signal) => {
      logger.info(`[shutdown] Sinal recebido: ${signal}. Encerrando servidor...`);

      server.close(async () => {
        try {
          await pool.end();
          logger.info('[shutdown] Servidor e conexao com banco encerrados');
          process.exit(0);
        } catch (error) {
          logger.error('[shutdown] Erro ao encerrar conexao com banco', error.message);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('[startup] Falha ao iniciar o backend', error.message);
    process.exit(1);
  }
}

startServer();
