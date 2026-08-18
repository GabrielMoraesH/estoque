const bcrypt = require('bcrypt');
const pool = require('../src/config/db');
const env = require('../src/config/env');
const { bcryptSaltRounds } = require('../src/config/security');

const E2E_LOGIN = 'e2e_admin';
const E2E_PASSWORD = 'E2E-test-only-123';
const E2E_ESTOQUISTA_LOGIN = 'e2e_estoquista';
const E2E_ESTOQUISTA_PASSWORD = 'E2E-estoquista-test-only-123';
// Mantém o contrato do catálogo mock atual, filtrado por empresa no frontend.
const E2E_EMPRESA_CODIGO = 'DIMEBRAS_PR';

function assertSafeE2eEnvironment() {
  if (env.nodeEnv !== 'test') {
    throw new Error('A fixture E2E exige NODE_ENV=test.');
  }

  if (!env.db.name.endsWith('_test')) {
    throw new Error('A fixture E2E exige DB_NAME terminado em _test.');
  }
}

async function seedE2e() {
  assertSafeE2eEnvironment();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        audit_logs,
        contagens,
        oc_assignment_produtos,
        oc_assignments,
        oc_localizacoes,
        oc_produtos,
        oc_items,
        ocs,
        user_empresas,
        users,
        empresas
      RESTART IDENTITY CASCADE
    `);
    const empresaResult = await client.query(
      `INSERT INTO empresas (codigo, nome, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ativo = true
       RETURNING id`,
      [E2E_EMPRESA_CODIGO, 'Empresa E2E Test Only']
    );
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, bcryptSaltRounds);
    const estoquistaPasswordHash = await bcrypt.hash(E2E_ESTOQUISTA_PASSWORD, bcryptSaltRounds);
    const userResult = await client.query(
      `INSERT INTO users (nome, login, senha, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (login) DO UPDATE
       SET nome = EXCLUDED.nome, senha = EXCLUDED.senha, role = EXCLUDED.role, ativo = true
       RETURNING id`,
      ['Administrador E2E Test Only', E2E_LOGIN, passwordHash]
    );
    const estoquistaResult = await client.query(
      `INSERT INTO users (nome, login, senha, role, nivel_estoquista, ativo)
       VALUES ($1, $2, $3, 'estoquista', 1, true)
       RETURNING id`,
      ['Estoquista E2E Test Only', E2E_ESTOQUISTA_LOGIN, estoquistaPasswordHash]
    );
    await client.query(
      `INSERT INTO user_empresas (user_id, empresa_id)
       VALUES ($1, $2), ($3, $2)
       ON CONFLICT DO NOTHING`,
      [userResult.rows[0].id, empresaResult.rows[0].id, estoquistaResult.rows[0].id]
    );
    await client.query('COMMIT');
    console.log(`Fixture E2E pronta: ${E2E_LOGIN} e ${E2E_ESTOQUISTA_LOGIN} (test-only).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedE2e().catch((error) => {
  console.error('Erro ao preparar fixture E2E:', error.message);
  process.exitCode = 1;
});
