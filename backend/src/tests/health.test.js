const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  end: jest.fn()
}));

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('deve retornar status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('preserva 503 e payload controlado no health legado quando o banco falha', async () => {
    pool.query.mockRejectedValue(new Error('connection details must not leak'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toEqual({ status: 'error' });
    expect(JSON.stringify(response.body)).not.toContain('connection details must not leak');
  });

  it('retorna liveness sem consultar PostgreSQL mesmo quando a query falharia', async () => {
    pool.query.mockRejectedValue(new Error('database unavailable'));

    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('retorna readiness 200 quando PostgreSQL responde', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('retorna readiness 503 sanitizado quando PostgreSQL falha', async () => {
    pool.query.mockRejectedValue(new Error('host=db password=secret SELECT 1'));

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toEqual({ status: 'error' });
    expect(JSON.stringify(response.body)).not.toMatch(/host=db|password|SELECT 1|stack/i);
  });

  it('retorna JSON controlado para rota inexistente', async () => {
    const response = await request(app).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        message: 'Recurso nao encontrado',
        code: 'NOT_FOUND',
        status: 404
      }
    });
  });
});
