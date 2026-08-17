const { createAuthRepository } = require('../modules/auth/authRepository');

describe('AuthRepository multiempresa', () => {
  it('reconstroi a sessao somente com empresas ativas e sem dados sensiveis no select agregado', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, empresas: [] }] }) };
    await createAuthRepository(db).findCurrentUserById(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('AND empresas.ativo = true');
    expect(sql).not.toMatch(/users\.senha|password|token/i);
    expect(params).toEqual([1]);
  });
});
