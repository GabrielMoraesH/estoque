const { createHealthService } = require('../modules/health/health.service');

describe('HealthService unitario com repository mockado', () => {
  it('retorna ok quando o banco responde ao ping', async () => {
    const repository = {
      pingDatabase: jest.fn().mockResolvedValue(undefined)
    };
    const service = createHealthService({
      repository,
      config: { nodeEnv: 'test' }
    });

    await expect(service.getHealth()).resolves.toMatchObject({
      statusCode: 200,
      body: {
        status: 'ok',
        environment: 'test',
        database: {
          status: 'ok'
        }
      }
    });
    expect(repository.pingDatabase).toHaveBeenCalledTimes(1);
  });

  it('retorna degraded quando o repository lanca excecao', async () => {
    const repository = {
      pingDatabase: jest.fn().mockRejectedValue(new Error('connection refused'))
    };
    const service = createHealthService({
      repository,
      config: { nodeEnv: 'test' }
    });

    await expect(service.getHealth()).resolves.toMatchObject({
      statusCode: 503,
      body: {
        status: 'degraded',
        environment: 'test',
        database: {
          status: 'error'
        }
      }
    });
  });

  it('inclui campos dinamicos sem depender de relogio ou banco real', async () => {
    const repository = {
      pingDatabase: jest.fn().mockResolvedValue(undefined)
    };
    const service = createHealthService({
      repository,
      config: { nodeEnv: 'unit' }
    });

    const result = await service.getHealth();

    expect(typeof result.body.uptime).toBe('number');
    expect(new Date(result.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('retorna liveness sem acessar o repository', async () => {
    const repository = {
      pingDatabase: jest.fn().mockRejectedValue(new Error('database unavailable'))
    };
    const service = createHealthService({ repository, config: { nodeEnv: 'test' } });

    await expect(service.getLiveness()).resolves.toEqual({
      statusCode: 200,
      body: { status: 'ok' }
    });
    expect(repository.pingDatabase).not.toHaveBeenCalled();
  });

  it('reutiliza o contrato de health para readiness', async () => {
    const repository = {
      pingDatabase: jest.fn().mockResolvedValue(undefined)
    };
    const service = createHealthService({ repository, config: { nodeEnv: 'test' } });

    await expect(service.getReadiness()).resolves.toMatchObject({
      statusCode: 200,
      body: {
        status: 'ok',
        database: { status: 'ok' }
      }
    });
    expect(repository.pingDatabase).toHaveBeenCalledTimes(1);
  });
});
