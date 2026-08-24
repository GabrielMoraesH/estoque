const bcrypt = require('bcrypt');
const {
  bootstrapAdmin,
  getBootstrapConfig
} = require('../../scripts/bootstrap-production');

function createClient({ existingUser, companies = [1, 2, 3, 5, 6], linkCount = 5, failLinks = false } = {}) {
  return {
    query: jest.fn(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT id, role, ativo FROM users')) return { rows: existingUser ? [existingUser] : [] };
      if (sql.includes('INSERT INTO users')) return { rows: [{ id: 42 }], rowCount: 1 };
      if (sql.includes('SELECT id, codigo FROM empresas')) {
        return { rows: companies.map((id, index) => ({ id, codigo: params[0][index] })) };
      }
      if (sql.includes('INSERT INTO user_empresas')) {
        if (failLinks) throw new Error('link failure');
        return { rows: [], rowCount: linkCount };
      }
      throw new Error(`Unexpected query: ${sql}`);
    })
  };
}

const logger = { info: jest.fn() };
const passwordHasher = { hash: jest.fn(async () => 'bcrypt-hash') };

beforeEach(() => jest.clearAllMocks());

describe('production bootstrap configuration', () => {
  const valid = {
    NODE_ENV: 'production',
    BOOTSTRAP_ADMIN_LOGIN: 'first.admin',
    BOOTSTRAP_ADMIN_PASSWORD: 'unique-secret-value'
  };

  it('exige ambiente production', () => {
    expect(() => getBootstrapConfig({ ...valid, NODE_ENV: 'test' })).toThrow('NODE_ENV=production');
  });

  it('exige login e senha externos', () => {
    expect(() => getBootstrapConfig({ ...valid, BOOTSTRAP_ADMIN_LOGIN: '' })).toThrow('BOOTSTRAP_ADMIN_LOGIN');
    expect(() => getBootstrapConfig({ ...valid, BOOTSTRAP_ADMIN_PASSWORD: '' })).toThrow('BOOTSTRAP_ADMIN_PASSWORD');
  });

  it.each(['admin', 'admin123', 'gestor123', 'estoque123', '123456', 'password', 'senha', 'short'])('rejeita senha insegura %s', (password) => {
    expect(() => getBootstrapConfig({ ...valid, BOOTSTRAP_ADMIN_PASSWORD: password })).toThrow('requisitos de seguranca');
  });
});

describe('production admin bootstrap', () => {
  it('cria somente admin com hash e vincula empresas semanticamente', async () => {
    const client = createClient();
    const result = await bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger });
    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));

    expect(passwordHasher.hash).toHaveBeenCalledWith('plain-secret', 10);
    expect(insert[1]).toEqual(['Administrador', 'first.admin', 'bcrypt-hash', 'admin']);
    expect(insert[1]).not.toContain('plain-secret');
    expect(result).toEqual({ created: true, linksCreated: 5 });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('e idempotente e nao reseta senha de admin existente', async () => {
    const client = createClient({ existingUser: { id: 7, role: 'admin' }, linkCount: 0 });
    const result = await bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO users'))).toBe(false);
    expect(result).toEqual({ created: false, linksCreated: 0 });
  });

  it('nao eleva silenciosamente um usuario existente', async () => {
    const client = createClient({ existingUser: { id: 7, role: 'gestor' } });
    await expect(bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger })).rejects.toThrow('perfil diferente');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('nao reativa silenciosamente um administrador existente', async () => {
    const client = createClient({ existingUser: { id: 7, role: 'admin', ativo: false } });
    await expect(bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger })).rejects.toThrow('desativado');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('faz rollback se empresas estiverem ausentes', async () => {
    const client = createClient({ companies: [1, 2] });
    await expect(bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger })).rejects.toThrow('Empresas estruturais');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('faz rollback se a criacao de vinculos falhar', async () => {
    const client = createClient({ failLinks: true });
    await expect(bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger })).rejects.toThrow('link failure');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('nao registra senha nem hash nos logs', async () => {
    const client = createClient();
    await bootstrapAdmin({ client, login: 'first.admin', password: 'plain-secret', passwordHasher, saltRounds: 10, logger });
    const output = logger.info.mock.calls.flat().join(' ');
    expect(output).not.toContain('plain-secret');
    expect(output).not.toContain('bcrypt-hash');
  });

  it('usa hash bcrypt compativel com o login da aplicacao', async () => {
    const hash = await bcrypt.hash('unique-password', 4);
    expect(hash).not.toBe('unique-password');
    await expect(bcrypt.compare('unique-password', hash)).resolves.toBe(true);
  });
});
