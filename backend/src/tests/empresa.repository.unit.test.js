const { createEmpresaRepository } = require('../modules/empresas/empresaRepository');

describe('EmpresaRepository', () => {
  it('lista contagens sem inflar o produto cartesiano e com ordenacao deterministica', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, usuarios_count: 3, ocs_count: 5 }] }) };
    const repository = createEmpresaRepository(db);
    await expect(repository.listAdmin()).resolves.toEqual([{ id: 1, usuarios_count: 3, ocs_count: 5 }]);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('COUNT(DISTINCT user_empresas.user_id)::int AS usuarios_count');
    expect(sql).toContain('COUNT(DISTINCT ocs.id)::int AS ocs_count');
    expect(sql).toContain('ORDER BY empresas.nome ASC, empresas.id ASC');
  });

  it('mantem listagem operacional limitada a empresas ativas', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await createEmpresaRepository(db).listActive();
    expect(db.query.mock.calls[0][0]).toContain('WHERE ativo = true');
  });

  it('parametriza criacao, nome e status sem interpolar input', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    const repository = createEmpresaRepository(db);
    await repository.create({ codigo: "X'Y", nome: 'Nome' });
    await repository.updateName({ id: 1, nome: "N'ovo" });
    await repository.updateStatus({ id: 1, ativo: false });
    expect(db.query.mock.calls[0][1]).toEqual(["X'Y", 'Nome']);
    expect(db.query.mock.calls[1][1]).toEqual(["N'ovo", 1]);
    expect(db.query.mock.calls[2][1]).toEqual([false, 1]);
  });
});
