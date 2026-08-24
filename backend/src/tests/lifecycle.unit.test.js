const { EventEmitter } = require('events');
const {
  SHUTDOWN_TIMEOUT_MS,
  createLifecycle,
  registerLifecycleHandlers
} = require('../lifecycle');

function createHarness(overrides = {}) {
  const server = new EventEmitter();
  server.close = jest.fn((callback) => callback());

  const pool = new EventEmitter();
  pool.end = jest.fn().mockResolvedValue();

  const processRef = new EventEmitter();
  processRef.exit = jest.fn();
  processRef.exitCode = undefined;

  const logger = {
    info: jest.fn(),
    error: jest.fn()
  };

  const lifecycle = createLifecycle({ server, pool, logger, processRef, ...overrides });
  return { server, pool, processRef, logger, lifecycle };
}

describe('backend lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('erro do pool e fatal e encerra HTTP e pool com codigo 1', async () => {
    const harness = createHarness();
    const unregister = registerLifecycleHandlers(harness);

    harness.pool.emit('error', new Error('idle client failure'));
    await harness.lifecycle.shutdown('test synchronization', 1);

    expect(harness.logger.error).toHaveBeenCalledWith(
      '[fatal] Erro inesperado no pool PostgreSQL',
      expect.stringContaining('idle client failure')
    );
    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
    expect(harness.processRef.exitCode).toBe(1);
    expect(harness.processRef.exit).not.toHaveBeenCalled();
    unregister();
  });

  test('SIGTERM executa shutdown operacional normal', async () => {
    const harness = createHarness();

    await harness.lifecycle.onSignal('SIGTERM');

    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
    expect(harness.processRef.exitCode).toBe(0);
  });

  test('registra SIGINT e remove todos os listeners sem vazamento', () => {
    const harness = createHarness();
    harness.lifecycle.onSignal = jest.fn();

    const unregister = registerLifecycleHandlers(harness);
    harness.processRef.emit('SIGINT');

    expect(harness.lifecycle.onSignal).toHaveBeenCalledWith('SIGINT');
    unregister();
    expect(harness.pool.listenerCount('error')).toBe(0);
    expect(harness.server.listenerCount('error')).toBe(0);
    expect(harness.processRef.eventNames()).toEqual([]);
  });

  test('shutdown e idempotente mesmo quando chamado novamente durante o fechamento', async () => {
    let finishClose;
    const harness = createHarness();
    harness.server.close.mockImplementation((callback) => {
      finishClose = callback;
    });

    const first = harness.lifecycle.shutdown('SIGTERM', 0);
    const second = harness.lifecycle.shutdown('duplicate signal', 0);

    expect(second).toBe(first);
    expect(harness.server.close).toHaveBeenCalledTimes(1);
    finishClose();
    await first;
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
  });

  test('chamada fatal posterior eleva o codigo sem repetir o cleanup', async () => {
    const harness = createHarness();

    await harness.lifecycle.shutdown('SIGTERM', 0);
    await harness.lifecycle.shutdown('late fatal error', 1);

    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
    expect(harness.processRef.exitCode).toBe(1);
  });

  test('timeout forca saida 1 quando o servidor nao conclui o fechamento', () => {
    jest.useFakeTimers();
    const harness = createHarness();
    harness.server.close.mockImplementation(() => {});

    harness.lifecycle.shutdown('SIGTERM', 0);
    jest.advanceTimersByTime(SHUTDOWN_TIMEOUT_MS);

    expect(harness.logger.error).toHaveBeenCalledWith(
      `[shutdown] Timeout de ${SHUTDOWN_TIMEOUT_MS}ms excedido; encerramento forcado`
    );
    expect(harness.processRef.exit).toHaveBeenCalledWith(1);
    expect(harness.server.close).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['onUnhandledRejection', 'Promise rejeitada sem tratamento', 'rejection'],
    ['onUncaughtException', 'Excecao nao capturada', 'exception']
  ])('%s registra a falha e encerra com codigo 1', async (handler, logMessage, message) => {
    const harness = createHarness();

    await harness.lifecycle[handler](new Error(message));

    expect(harness.logger.error).toHaveBeenCalledWith(
      `[fatal] ${logMessage}`,
      expect.stringContaining(message)
    );
    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
    expect(harness.processRef.exitCode).toBe(1);
  });

  test('EADDRINUSE registra contexto seguro e executa cleanup fatal', async () => {
    const harness = createHarness();
    const error = Object.assign(new Error('address already in use'), {
      code: 'EADDRINUSE',
      address: '127.0.0.1',
      port: 3000
    });

    await harness.lifecycle.onServerError(error);

    expect(harness.logger.error).toHaveBeenCalledWith('[fatal] Erro no listener HTTP', {
      code: 'EADDRINUSE',
      message: 'address already in use',
      host: '127.0.0.1',
      port: 3000
    });
    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.pool.end).toHaveBeenCalledTimes(1);
    expect(harness.processRef.exitCode).toBe(1);
  });

  test('falha de pool.end e registrada e torna o exit code fatal', async () => {
    const harness = createHarness();
    harness.pool.end.mockRejectedValue(new Error('pool close failure'));

    await harness.lifecycle.shutdown('SIGTERM', 0);

    expect(harness.logger.error).toHaveBeenCalledWith(
      '[shutdown] Erro ao encerrar conexao com banco',
      expect.stringContaining('pool close failure')
    );
    expect(harness.processRef.exitCode).toBe(1);
  });
});
