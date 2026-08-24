const SHUTDOWN_TIMEOUT_MS = 10_000;

function describeError(error) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

function createLifecycle({
  server,
  pool,
  logger,
  processRef = process,
  shutdownTimeoutMs = SHUTDOWN_TIMEOUT_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  let shutdownPromise;
  let exitCode = 0;

  function closeServer() {
    return new Promise((resolve, reject) => {
      try {
        server.close((error) => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(error);
            return;
          }

          resolve();
        });
      } catch (error) {
        if (error.code === 'ERR_SERVER_NOT_RUNNING') {
          resolve();
          return;
        }

        reject(error);
      }
    });
  }

  function shutdown(reason, requestedExitCode = 0) {
    exitCode = Math.max(exitCode, requestedExitCode);

    if (shutdownPromise) {
      processRef.exitCode = exitCode;
      return shutdownPromise;
    }

    logger.info(`[shutdown] Encerramento iniciado: ${reason}`);

    let timeout;
    shutdownPromise = (async () => {
      timeout = setTimeoutFn(() => {
        logger.error(`[shutdown] Timeout de ${shutdownTimeoutMs}ms excedido; encerramento forcado`);
        processRef.exit(1);
      }, shutdownTimeoutMs);

      try {
        await closeServer();
      } catch (error) {
        exitCode = 1;
        logger.error('[shutdown] Erro ao encerrar servidor HTTP', describeError(error));
      }

      try {
        await pool.end();
      } catch (error) {
        exitCode = 1;
        logger.error('[shutdown] Erro ao encerrar conexao com banco', describeError(error));
      }

      clearTimeoutFn(timeout);
      processRef.exitCode = exitCode;
      logger.info(`[shutdown] Recursos encerrados; codigo de saida ${exitCode}`);
    })();

    return shutdownPromise;
  }

  function onPoolError(error) {
    logger.error('[fatal] Erro inesperado no pool PostgreSQL', describeError(error));
    return shutdown('pool error', 1);
  }

  function onServerError(error) {
    logger.error('[fatal] Erro no listener HTTP', {
      code: error.code,
      message: error.message,
      host: error.address,
      port: error.port
    });
    return shutdown('listener error', 1);
  }

  function onSignal(signal) {
    logger.info(`[shutdown] Sinal recebido: ${signal}`);
    return shutdown(signal, 0);
  }

  function onUnhandledRejection(reason) {
    logger.error('[fatal] Promise rejeitada sem tratamento', describeError(reason));
    return shutdown('unhandled rejection', 1);
  }

  function onUncaughtException(error) {
    logger.error('[fatal] Excecao nao capturada', describeError(error));
    return shutdown('uncaught exception', 1);
  }

  return {
    shutdown,
    onPoolError,
    onServerError,
    onSignal,
    onUnhandledRejection,
    onUncaughtException
  };
}

function registerLifecycleHandlers({ server, pool, processRef = process, lifecycle }) {
  const onSigint = () => lifecycle.onSignal('SIGINT');
  const onSigterm = () => lifecycle.onSignal('SIGTERM');

  pool.on('error', lifecycle.onPoolError);
  server.on('error', lifecycle.onServerError);
  processRef.on('SIGINT', onSigint);
  processRef.on('SIGTERM', onSigterm);
  processRef.on('unhandledRejection', lifecycle.onUnhandledRejection);
  processRef.on('uncaughtException', lifecycle.onUncaughtException);

  return () => {
    pool.removeListener('error', lifecycle.onPoolError);
    server.removeListener('error', lifecycle.onServerError);
    processRef.removeListener('SIGINT', onSigint);
    processRef.removeListener('SIGTERM', onSigterm);
    processRef.removeListener('unhandledRejection', lifecycle.onUnhandledRejection);
    processRef.removeListener('uncaughtException', lifecycle.onUncaughtException);
  };
}

module.exports = {
  SHUTDOWN_TIMEOUT_MS,
  createLifecycle,
  describeError,
  registerLifecycleHandlers
};
