const bcrypt = require('bcrypt');
const { EMPRESAS_FIXAS } = require('../src/modules/empresas/empresaConstants');

const ADMIN_ROLE = 'admin';
const DEFAULT_ADMIN_NAME = 'Administrador';
const KNOWN_INSECURE_PASSWORDS = new Set([
  'admin',
  'admin123',
  'gestor123',
  'estoque123',
  '123456',
  'password',
  'senha'
]);

function getBootstrapConfig(environment = process.env) {
  if (environment.NODE_ENV !== 'production') {
    throw new Error('Bootstrap exige NODE_ENV=production.');
  }

  const login = environment.BOOTSTRAP_ADMIN_LOGIN?.trim();
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD;

  if (!login) {
    throw new Error('Variavel de ambiente obrigatoria ausente: BOOTSTRAP_ADMIN_LOGIN');
  }

  if (!password) {
    throw new Error('Variavel de ambiente obrigatoria ausente: BOOTSTRAP_ADMIN_PASSWORD');
  }

  if (password.length < 6 || KNOWN_INSECURE_PASSWORDS.has(password.toLowerCase())) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD nao atende aos requisitos de seguranca.');
  }

  return { login, password };
}

async function bootstrapAdmin({ client, login, password, passwordHasher, saltRounds, logger = console }) {
  await client.query('BEGIN');

  try {
    const existingResult = await client.query(
      'SELECT id, role, ativo FROM users WHERE login = $1 FOR UPDATE',
      [login]
    );
    let adminId;
    let created = false;

    if (existingResult.rows[0]) {
      if (existingResult.rows[0].role !== ADMIN_ROLE) {
        throw new Error('O login configurado ja existe com perfil diferente de admin.');
      }
      if (existingResult.rows[0].ativo === false) {
        throw new Error('O administrador inicial existe, mas esta desativado.');
      }
      adminId = existingResult.rows[0].id;
      logger.info('Administrador inicial ja existe; senha preservada.');
    } else {
      const passwordHash = await passwordHasher.hash(password, saltRounds);
      const inserted = await client.query(
        `INSERT INTO users (nome, login, senha, role, nivel_estoquista)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id`,
        [DEFAULT_ADMIN_NAME, login, passwordHash, ADMIN_ROLE]
      );
      adminId = inserted.rows[0].id;
      created = true;
      logger.info('Administrador inicial criado.');
    }

    const companyCodes = EMPRESAS_FIXAS.map((empresa) => empresa.codigo);
    const companies = await client.query(
      `SELECT id, codigo FROM empresas
       WHERE ativo = true AND codigo = ANY($1::text[])
       ORDER BY codigo`,
      [companyCodes]
    );

    if (companies.rows.length !== companyCodes.length) {
      throw new Error('Empresas estruturais obrigatorias nao foram encontradas ou estao inativas.');
    }

    const links = await client.query(
      `INSERT INTO user_empresas (user_id, empresa_id)
       SELECT $1, unnest($2::int[])
       ON CONFLICT DO NOTHING
       RETURNING empresa_id`,
      [adminId, companies.rows.map((empresa) => empresa.id)]
    );

    logger.info(`${links.rowCount} vinculo(s) de empresa criado(s).`);
    await client.query('COMMIT');
    return { created, linksCreated: links.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runBootstrap({ environment = process.env, logger = console } = {}) {
  const config = getBootstrapConfig(environment);
  const pool = require('../src/config/db');
  const { bcryptSaltRounds } = require('../src/config/security');
  let client;

  logger.info('Bootstrap production iniciado.');
  try {
    client = await pool.connect();
    const result = await bootstrapAdmin({
      client,
      login: config.login,
      password: config.password,
      passwordHasher: bcrypt,
      saltRounds: bcryptSaltRounds,
      logger
    });
    logger.info('Bootstrap production concluido.');
    return result;
  } finally {
    client?.release();
    await pool.end();
  }
}

if (require.main === module) {
  runBootstrap().catch(() => {
    console.error('Bootstrap production falhou.');
    process.exitCode = 1;
  });
}

module.exports = { bootstrapAdmin, getBootstrapConfig, runBootstrap };
