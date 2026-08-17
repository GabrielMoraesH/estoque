const { getSeedPassword, seedUsers } = require('../../scripts/seed');

describe('seed credentials', () => {
  const admin = seedUsers.find((user) => user.login === 'admin');

  it('mantem a senha padrao somente fora de producao', () => {
    expect(getSeedPassword(admin, 'development')).toBe('admin123');
  });

  it('exige credencial explicita em producao', () => {
    expect(() => getSeedPassword(admin, 'production')).toThrow('SEED_ADMIN_PASSWORD');
  });

  it('recusa em producao a senha padrao conhecida, mesmo quando configurada', () => {
    expect(() => getSeedPassword(admin, 'production', 'admin123')).toThrow('Credencial padrao insegura');
  });

  it('aceita em producao uma credencial explicita que nao seja a padrao', () => {
    expect(getSeedPassword(admin, 'production', 'senha-segura-e-unica')).toBe('senha-segura-e-unica');
  });
});
