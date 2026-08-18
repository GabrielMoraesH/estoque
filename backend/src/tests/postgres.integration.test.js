const pool = require('../config/db');
const { createOcRepository } = require('../modules/ocs/oc.repository');
const { createEmpresaRepository } = require('../modules/empresas/empresaRepository');

if (process.env.NODE_ENV !== 'test' || !process.env.DB_NAME?.endsWith('_test')) {
  throw new Error('PostgreSQL integration tests require NODE_ENV=test and a DB_NAME ending in _test');
}

jest.setTimeout(10000);

async function resetDatabase() {
  await pool.query(`
    TRUNCATE TABLE
      oc_assignment_produtos,
      contagens,
      oc_localizacoes,
      oc_produtos,
      oc_assignments,
      oc_items,
      ocs,
      user_empresas,
      audit_logs,
      users,
      empresas
    RESTART IDENTITY CASCADE
  `);
}

async function createFixture() {
  const empresaA = (await pool.query(
    "INSERT INTO empresas (codigo, nome) VALUES ('TEST_A', 'Empresa A') RETURNING id"
  )).rows[0];
  const empresaB = (await pool.query(
    "INSERT INTO empresas (codigo, nome) VALUES ('TEST_B', 'Empresa B') RETURNING id"
  )).rows[0];
  const users = (await pool.query(`
    INSERT INTO users (nome, login, senha, role, nivel_estoquista)
    VALUES
      ('Gestor', 'gestor-test', 'hash', 'gestor', NULL),
      ('Anterior', 'anterior-test', 'hash', 'estoquista', 1),
      ('Novo A', 'novo-a-test', 'hash', 'estoquista', 1),
      ('Novo B', 'novo-b-test', 'hash', 'estoquista', 1)
    RETURNING id, login
  `)).rows;
  const byLogin = Object.fromEntries(users.map((user) => [user.login, user.id]));
  await pool.query(
    'INSERT INTO user_empresas (user_id, empresa_id) VALUES ($1, $2), ($3, $2), ($4, $2), ($5, $6)',
    [byLogin['gestor-test'], empresaA.id, byLogin['anterior-test'], byLogin['novo-a-test'], byLogin['novo-b-test'], empresaB.id]
  );
  const oc = (await pool.query(
    `INSERT INTO ocs (codigo, gestor_id, estoquista_id, empresa_id, status)
     VALUES ('OC-TEST', $1, $1, $2, 'aberta') RETURNING id`,
    [byLogin['gestor-test'], empresaA.id]
  )).rows[0];
  const assignment = (await pool.query(
    `INSERT INTO oc_assignments (oc_id, ciclo, fase, estoquista_id, status)
     VALUES ($1, 1, 'contagem', $2, 'ativo') RETURNING id`,
    [oc.id, byLogin['anterior-test']]
  )).rows[0];
  return { empresaA, empresaB, oc, assignment, byLogin };
}

describe('PostgreSQL integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it('has all migrations registered and the final schema constraint', async () => {
    const migrations = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    expect(migrations.rows.map((row) => row.version)).toEqual([
      '001_initial_schema.sql', '002_create_audit_logs.sql', '003_harden_schema_for_production.sql',
      '004_add_nivel_estoquista_and_recount_assignment.sql', '005_create_empresas_and_user_empresas.sql',
      '006_add_empresa_id_to_ocs.sql', '007_add_missing_base_timestamps.sql',
      '008_foundation_new_oc_model.sql', '009_add_assignment_products.sql',
      '010_allow_new_model_counts_without_legacy_item.sql'
    ]);
    await expect(pool.query("INSERT INTO users (nome, login, senha, role) VALUES ('X', 'invalid-role', 'hash', 'invalid')"))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('isolates company membership and resolves concurrent reassignment with one conflict', async () => {
    const fixture = await createFixture();
    const ocRepository = createOcRepository(pool);
    const empresaRepository = createEmpresaRepository(pool);

    await expect(empresaRepository.userHasEmpresaAccess(fixture.byLogin['novo-b-test'], fixture.empresaA.id)).resolves.toBe(false);
    await expect(empresaRepository.userHasEmpresaAccess(fixture.byLogin['novo-b-test'], fixture.empresaB.id)).resolves.toBe(true);

    const results = await Promise.all([
      ocRepository.reassignActiveAssignment({ assignmentId: fixture.assignment.id, ocId: fixture.oc.id, previousEstoquistaId: fixture.byLogin['anterior-test'], novoEstoquistaId: fixture.byLogin['novo-a-test'] }),
      ocRepository.reassignActiveAssignment({ assignmentId: fixture.assignment.id, ocId: fixture.oc.id, previousEstoquistaId: fixture.byLogin['anterior-test'], novoEstoquistaId: fixture.byLogin['novo-b-test'] })
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const persisted = await pool.query('SELECT estoquista_id FROM oc_assignments WHERE id = $1', [fixture.assignment.id]);
    expect([fixture.byLogin['novo-a-test'], fixture.byLogin['novo-b-test']]).toContain(persisted.rows[0].estoquista_id);
  });
});
