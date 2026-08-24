const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');
const logger = require('../utils/logger');
const requestId = require('../middlewares/requestId');
const requestLogger = require('../middlewares/requestLogger');
const errorHandler = require('../middlewares/errorHandler');
const { getRequestContext } = require('../utils/requestContext');

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

function createApp(routeMiddleware, { trustProxy = false, middleware } = {}) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(requestId);
  app.use(requestLogger);
  if (middleware) {
    app.use(middleware);
  }
  app.get('/test', routeMiddleware || ((req, res) => {
    res.json({
      requestId: req.requestId,
      ip: req.ip,
      ips: req.ips,
      auditContext: getRequestContext(req)
    });
  }));
  app.use(errorHandler);
  return app;
}

describe('Contexto HTTP correlacionavel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gera UUIDs distintos e devolve exatamente o ID disponivel na request', async () => {
    const app = createApp();
    const [first, second] = await Promise.all([
      request(app).get('/test').set('X-Request-ID', 'valor-externo'),
      request(app).get('/test')
    ]);

    for (const response of [first, second]) {
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
      expect(response.body.auditContext.requestId).toBe(response.headers['x-request-id']);
    }
    expect(first.headers['x-request-id']).not.toBe('valor-externo');
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('inclui o mesmo ID no access log e preserva method, path sem query, status e duracao', async () => {
    const response = await request(createApp()).get('/test?secret=query');

    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`^\\[request\\] \\[request_id=${response.headers['x-request-id']}\\] GET /test 200 \\d+ms$`)
    ));
    expect(logger.info.mock.calls[0][0]).not.toContain('secret=query');
  });

  it('mantem o header no 500 e registra contexto tecnico seguro e stack', async () => {
    const failure = new Error('database unavailable');
    const app = createApp((req, res, next) => {
      req.user = { id: 7, nome: 'Nao deve aparecer' };
      req.empresaId = 12;
      next(failure);
    });
    const response = await request(app).get('/test?token=nao-logar');

    expect(response.status).toBe(500);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(logger.error).toHaveBeenCalledWith(
      `[error] [request_id=${response.headers['x-request-id']}] [user_id=7] [empresa_id=12] GET /test 500`,
      failure.stack
    );
    expect(logger.error.mock.calls[0].join(' ')).not.toContain('Nao deve aparecer');
    expect(logger.error.mock.calls[0].join(' ')).not.toContain('token=nao-logar');
  });

  it('ignora X-Forwarded-For arbitrario em request direta sem proxy confiavel', async () => {
    const response = await request(createApp())
      .get('/test')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(response.body.ip).not.toBe('203.0.113.10');
    expect(response.body.ips).toEqual([]);
    expect(response.body.auditContext.ipAddress).toBe(response.body.ip);
  });

  it('resolve o cliente e o audit context por um unico proxy confiavel', async () => {
    const response = await request(createApp(undefined, { trustProxy: 1 }))
      .get('/test')
      .set('X-Forwarded-For', '203.0.113.20');

    expect(response.body.ip).toBe('203.0.113.20');
    expect(response.body.ips).toEqual(['203.0.113.20']);
    expect(response.body.auditContext.ipAddress).toBe(response.body.ip);
  });

  it('confia somente no endereco mais proximo em uma cadeia com um hop confiavel', async () => {
    const response = await request(createApp(undefined, { trustProxy: 1 }))
      .get('/test')
      .set('X-Forwarded-For', '198.51.100.30, 203.0.113.30');

    expect(response.body.ip).toBe('203.0.113.30');
    expect(response.body.ips).toEqual(['203.0.113.30']);
    expect(response.body.auditContext.ipAddress).toBe(response.body.ip);
  });

  it('rate limit separa clientes e mantem o mesmo cliente na mesma chave', async () => {
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      standardHeaders: true,
      legacyHeaders: false
    });
    const app = createApp(undefined, { trustProxy: 1, middleware: limiter });

    const firstA = await request(app).get('/test').set('X-Forwarded-For', '203.0.113.40');
    const secondA = await request(app).get('/test').set('X-Forwarded-For', '203.0.113.40');
    const firstB = await request(app).get('/test').set('X-Forwarded-For', '203.0.113.41');

    expect(firstA.status).toBe(200);
    expect(secondA.status).toBe(429);
    expect(firstB.status).toBe(200);
  });

  it('configura exatamente um hop confiavel no app de production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    let productionApp;

    try {
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        productionApp = require('../app');
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }

    expect(productionApp.get('trust proxy')).toBe(1);
  });
});
