const { OC_REPOSITORY_METHODS } = require('../modules/ocs/IOcRepository');
const { createOcService, EXPORT_LIMIT, filterExportRows, getOperationalExportStatus, toExportCsvRow } = require('../modules/ocs/oc.service');
const { createAuditService } = require('../modules/audit/auditService');
const { createOcRepository } = require('../modules/ocs/oc.repository');
const { escapeCsvValue, protectCsvFormula, safeFilenamePart, serializeCsv } = require('../modules/ocs/ocExport');

function repositoryWith(rows) {
  const repository = Object.fromEntries(OC_REPOSITORY_METHODS.map((method) => [method, jest.fn()]));
  repository.listByGestor.mockImplementation(async ({ exportFilters, limit }) => {
    const filtered = exportFilters ? filterExportRows(rows, exportFilters) : rows;
    return limit === null || limit === undefined ? filtered : filtered.slice(0, limit);
  });
  return repository;
}

const rows = [
  { id: 3, codigo: 'OC-3', empresa_id: 1, empresa_codigo: 'ALFAMED_MS', empresa_nome: 'Alfamed MS', gestor_id: 12, criador_nome: 'Gestor B', estoquista_id: 22, responsavel_atual_id: 33, estoquista_nome: 'Recontador', status: 'aberta', assignment_fase: 'recontagem', assignment_status: 'ativo', assignment_ciclo: 2, qtd: 2, total_localizacoes: 3, localizacoes_contadas: 1, created_at: '2026-08-15T10:00:00Z', ultima_movimentacao_em: '2026-08-17T12:00:00Z' },
  { id: 2, codigo: 'OC-2', empresa_id: 1, empresa_codigo: 'ALFAMED_MS', gestor_id: 11, criador_nome: 'Gestor A', estoquista_id: 22, estoquista_nome: 'Contador', status: 'aguardando_aprovacao', qtd: 1, total_localizacoes: 2, localizacoes_contadas: 2, created_at: '2026-08-14T10:00:00Z', ultima_movimentacao_em: '2026-08-16T12:00:00Z' },
  { id: 1, codigo: '=PERIGO,"A"\nB', empresa_id: 1, empresa_codigo: 'ALFAMED_MS', gestor_id: 11, criador_nome: 'José', estoquista_id: 22, estoquista_nome: 'Ana', status: 'finalizada', qtd: 1, total_localizacoes: 1, localizacoes_contadas: 1, created_at: '2026-08-13T10:00:00Z', ultima_movimentacao_em: '2026-08-15T12:00:00Z' },
  { id: 4, codigo: 'LEG-4', empresa_id: 1, gestor_id: 11, estoquista_id: 44, estoquista_nome: 'Legado', status: 'aberta', has_legacy_recount: true, qtd: 2, total_localizacoes: 2, localizacoes_contadas: 1, created_at: '2026-08-12T10:00:00Z', ultima_movimentacao_em: '2026-08-14T12:00:00Z' }
];

describe('exportacao administrativa de OCs', () => {
  it('mantem a semantica operacional de novo modelo e legado', () => {
    expect(rows.map(getOperationalExportStatus)).toEqual(['em_recontagem', 'aguardando_aprovacao', 'finalizada', 'em_recontagem']);
    expect(toExportCsvRow(rows[0])).toEqual(expect.arrayContaining(['Recontador', '1/3 localizações', 2, 'recontagem']));
    expect(toExportCsvRow(rows[3])).toEqual(expect.arrayContaining(['Legado', '1/2 localizações']));
  });

  it('combina status, periodo, criador, responsavel e busca sem incluir outra empresa', () => {
    const result = filterExportRows(rows, { status: 'em_recontagem', date_from: '2026-08-15', date_to: '2026-08-15', creator_id: 12, responsible_id: 33, search: 'oc-3' });
    expect(result.map((row) => row.id)).toEqual([3]);
  });

  it('escapa virgula, aspas, quebra de linha, acento e formula injection', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('a"b')).toBe('"a""b"');
    expect(escapeCsvValue('a\nb')).toBe('"a\nb"');
    expect(escapeCsvValue('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(escapeCsvValue('  +1')).toBe('"\'  +1"');
    expect(serializeCsv([toExportCsvRow(rows[2])])).toContain('José');
    expect(serializeCsv([]).charCodeAt(0)).toBe(0xFEFF);
  });

  it('gera filename seguro sem aceitar injecao', () => {
    expect(safeFilenamePart('../../Alfá Med\r\n.csv')).toBe('Alfa_Med_csv');
  });

  it.each(['admin', 'gestor'])('%s exporta OCs da empresa e registra auditoria minima', async (role) => {
    const repository = repositoryWith(rows);
    const audit = { logAction: jest.fn().mockResolvedValue() };
    const service = createOcService({ repository, audit });
    const result = await service.exportOcsCsv({ user: { id: 7, role }, empresaId: 1, empresa: { codigo: 'ALFAMED_MS' }, filters: { status: 'em_recontagem' } });
    expect(result.csv).toContain('OC-3');
    expect(repository.listByGestor).toHaveBeenCalledWith({ empresaId: 1, exportFilters: { status: 'em_recontagem' }, limit: EXPORT_LIMIT + 1 });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 7, role }, action: 'oc.exported', metadata: expect.objectContaining({ empresa_id: 1, formato: 'csv', quantidade_registros: 2 }) }));
  });

  it('falha da auditoria best-effort nao invalida o CSV', async () => {
    const audit = createAuditService({ repository: { create: jest.fn().mockRejectedValue(new Error('db')) }, loggerDependency: { error: jest.fn() } });
    await expect(createOcService({ repository: repositoryWith(rows), audit }).exportOcsCsv({ user: { id: 1, role: 'admin' }, empresaId: 1, empresa: { codigo: 'A' } })).resolves.toHaveProperty('csv');
  });

  it('recusa resultado acima do limite sem truncar', async () => {
    const repository = repositoryWith(Array.from({ length: EXPORT_LIMIT + 1 }, (_, id) => ({ id, status: 'aberta' })));
    const audit = { logAction: jest.fn() };
    const service = createOcService({ repository, audit });
    await expect(service.exportOcsCsv({ user: { id: 1, role: 'admin' }, empresaId: 1, empresa: { codigo: 'A' } })).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.listByGestor).toHaveBeenCalledWith(expect.objectContaining({ limit: EXPORT_LIMIT + 1 }));
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('aceita exatamente o limite e nao audita falha do serializador', async () => {
    const exactRows = Array.from({ length: EXPORT_LIMIT }, (_, id) => ({ id, status: 'aberta' }));
    await expect(createOcService({ repository: repositoryWith(exactRows) }).exportOcsCsv({ user: { id: 1, role: 'admin' }, empresaId: 1, empresa: { codigo: 'A' } })).resolves.toHaveProperty('count', EXPORT_LIMIT);
    const audit = { logAction: jest.fn() };
    const service = createOcService({ repository: repositoryWith(rows), audit, csvSerializer: () => { throw new Error('serializer'); } });
    await expect(service.exportOcsCsv({ user: { id: 1, role: 'admin' }, empresaId: 1, empresa: { codigo: 'A' } })).rejects.toThrow('serializer');
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('cobre datas inclusivas, dia seguinte excluido e busca literal', () => {
    const boundaryRows = [
      { id: 1, codigo: 'OC%_1', created_at: '2026-08-15T00:00:00.000Z' },
      { id: 2, codigo: 'OCXX1', created_at: '2026-08-15T23:59:59.999Z' },
      { id: 3, codigo: 'OC%_1', created_at: '2026-08-16T00:00:00.000Z' }
    ];
    expect(filterExportRows(boundaryRows, { date_from: '2026-08-15', date_to: '2026-08-15' }).map(({ id }) => id)).toEqual([1, 2]);
    expect(filterExportRows(boundaryRows, { search: '%_' }).map(({ id }) => id)).toEqual([1, 3]);
  });

  it('cobre precedencia defensiva, progresso vigente e tipos CSV', () => {
    expect(getOperationalExportStatus({ status: 'aguardando_aprovacao', assignment_fase: 'recontagem', assignment_status: 'ativo' })).toBe('em_recontagem');
    expect(getOperationalExportStatus({ status: 'finalizada', has_legacy_recount: true })).toBe('finalizada');
    expect(toExportCsvRow({ status: 'aberta', assignment_fase: 'recontagem', assignment_status: 'finalizado', assignment_ciclo: 2, estoquista_nome: 'Recontador', total_localizacoes: 5, localizacoes_contadas: 2 })).toEqual(expect.arrayContaining(['Recontador', '2/5 localiza\u00e7\u00f5es']));
    expect(protectCsvFormula(-10)).toBe('-10');
    expect(protectCsvFormula('-10')).toBe("'-10");
    for (const prefix of [' ', '\t', '\r', '\n']) expect(protectCsvFormula(`${prefix}=SUM(1+1)`)).toBe(`'${prefix}=SUM(1+1)`);
    expect(escapeCsvValue(null)).toBe('""');
    expect(escapeCsvValue(undefined)).toBe('""');
    expect(escapeCsvValue(true)).toBe('"true"');
    expect(escapeCsvValue({ b: 2, a: 1 })).not.toContain('[object Object]');
    expect(serializeCsv([]).split('\uFEFF')).toHaveLength(2);
  });

  it('parametriza filtros PostgreSQL, escapa wildcards e aplica LIMIT 2001', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = createOcRepository(db);
    await repository.listByGestor({ empresaId: 1, exportFilters: { search: '%_', status: 'em_recontagem', date_from: '2026-08-01', date_to: '2026-08-15', creator_id: 7, responsible_id: 8 }, limit: EXPORT_LIMIT + 1 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain('LIMIT $');
    expect(params).toEqual([1, null, '\\%\\_', 7, 8, '2026-08-01', '2026-08-15', 'em_recontagem', EXPORT_LIMIT + 1]);
  });
});
