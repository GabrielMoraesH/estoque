const { createAuditService, sanitizeMetadata, isSensitiveMetadataKey } = require('../modules/audit/auditService');
const { createAuditRepository } = require('../modules/audit/audit.repository');

describe('Auditoria', () => {
  it('remove dados sensiveis em qualquer profundidade antes de persistir', async () => {
    const repository = { create: jest.fn().mockResolvedValue(undefined) };
    const service = createAuditService({ repository, loggerDependency: { error: jest.fn() } });
    await service.logAction({
      user: { id: 7, role: 'admin' }, action: 'user.updated', entityType: 'user', entityId: 9,
      metadata: { password: 'x', senha_nova: 'y', safe: true, nested: { authorization: 'Bearer secret', role: 'gestor' } }
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, metadata: { safe: true, nested: { role: 'gestor' } }
    }));
  });

  it('mantem a operacao principal best-effort quando a auditoria falha', async () => {
    const logger = { error: jest.fn() };
    const service = createAuditService({ repository: { create: jest.fn().mockRejectedValue(new Error('db')) }, loggerDependency: logger });
    await expect(service.logAction({
      action: 'oc.created', entityType: 'oc', entityId: 10, auditContext: { requestId: 'request-123' }
    })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      '[audit_error] [request_id=request-123] [action=oc.created] [entity_type=oc] [entity_id=10]'
    );
  });

  it('propaga falha quando a auditoria participa de uma transacao', async () => {
    const error = new Error('audit transaction failed');
    const transactionClient = { query: jest.fn() };
    const service = createAuditService({
      repository: { create: jest.fn().mockRejectedValue(error) },
      loggerDependency: { error: jest.fn() }
    });
    await expect(service.logAction({
      action: 'oc.created', entityType: 'oc', transactionClient
    })).rejects.toBe(error);
  });

  it('usa exatamente o client transacional recebido no repository', async () => {
    const transactionClient = { query: jest.fn() };
    const repository = { create: jest.fn().mockResolvedValue() };
    const service = createAuditService({ repository, loggerDependency: { error: jest.fn() } });
    await service.logAction({ action: 'oc.created', entityType: 'oc', transactionClient });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'oc.created' }), transactionClient);
  });

  it('pagina e ordena deterministicamente usando apenas parametros SQL', async () => {
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [{ total: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] }) };
    const result = await createAuditRepository(db).list({ page: 2, limit: 25, search: "x' OR 1=1 --", action: 'oc.approved' });
    expect(result).toEqual({ items: [{ id: 1 }], total: 1 });
    expect(db.query.mock.calls[1][0]).toContain('ORDER BY audit_logs.created_at DESC, audit_logs.id DESC');
    expect(db.query.mock.calls[1][1]).toEqual(["x' OR 1=1 --", 'oc.approved', 25, 25]);
  });

  it('aceita metadata antiga nula e objetos circulares sem vazar segredo', () => {
    const value = { ok: 1 }; value.self = value; value.jwt = 'secret';
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata(value)).toEqual({ ok: 1, self: '[circular]' });
  });

  it.each(['password', 'Password', 'PASSWORD', 'password_hash', 'passwordHash', 'accessToken', 'refresh_token', 'Authorization', 'clientSecret'])('reconhece a chave sensivel %s', (key) => {
    expect(isSensitiveMetadataKey(key)).toBe(true);
  });

  it('preserva chave legitima e limita estruturas grandes', () => {
    const value = { token_count: 4, items: Array.from({ length: 120 }, (_, index) => index), text: 'a'.repeat(2100) };
    const result = sanitizeMetadata(value);
    expect(result.token_count).toBe(4);
    expect(result.items).toHaveLength(100);
    expect(result.text).toHaveLength(2011);
    expect(result.text.endsWith('[truncated]')).toBe(true);
  });

  it('trata tipos primitivos, datas, arrays aninhados e profundidade excessiva', () => {
    expect(sanitizeMetadata(undefined)).toBeNull();
    expect(sanitizeMetadata('texto')).toBe('texto');
    expect(sanitizeMetadata(2)).toBe(2);
    expect(sanitizeMetadata(true)).toBe(true);
    expect(sanitizeMetadata(new Date('2026-08-17T12:00:00Z'))).toBe('2026-08-17T12:00:00.000Z');
    expect(sanitizeMetadata([null, { Password: 'x', safe: 1 }])).toEqual([null, { safe: 1 }]);
    const deep = sanitizeMetadata({ a: { b: { c: { d: { e: { f: 1 } } } } } });
    expect(deep.a.b.c.d.e).toBe('[redacted]');
  });

  it('usa os mesmos filtros no COUNT e na listagem', async () => {
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] }) };
    await createAuditRepository(db).list({ page: 1, limit: 10, search: 'ana', action: 'oc.created', entityType: 'oc', empresaId: 2, dateFrom: '2026-08-01', dateTo: '2026-08-17' });
    const [countSql, countParams] = db.query.mock.calls[0];
    const [listSql, listParams] = db.query.mock.calls[1];
    const countWhere = countSql.slice(countSql.indexOf('WHERE'));
    const listWhere = listSql.slice(listSql.indexOf('WHERE'), listSql.indexOf('ORDER BY')).trim();
    expect(listWhere).toBe(countWhere.trim());
    expect(countParams).toEqual(['ana', 'oc.created', 'oc', '2', '2026-08-01', '2026-08-17']);
    expect(listParams).toEqual([...countParams, 10, 0]);
    expect(listSql).toContain("created_at < ($6::date + INTERVAL '1 day')");
  });
});
