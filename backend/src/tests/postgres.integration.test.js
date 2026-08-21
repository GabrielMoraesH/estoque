const pool = require('../config/db');
const { createOcRepository } = require('../modules/ocs/oc.repository');
const { createOcService } = require('../modules/ocs/oc.service');
const { createEmpresaRepository } = require('../modules/empresas/empresaRepository');
const { createAuditService } = require('../modules/audit/auditService');

if (process.env.NODE_ENV !== 'test' || !process.env.DB_NAME?.endsWith('_test')) {
  throw new Error('PostgreSQL integration tests require NODE_ENV=test and a DB_NAME ending in _test');
}

jest.setTimeout(10000);

const ITEM_STATUS = { approved: 'aprovado', counted: 'contado' };
const OC_STATUS = { open: 'aberta', waitingApproval: 'aguardando_aprovacao', finalized: 'finalizada' };

async function resetDatabase() {
  await pool.query(`
    TRUNCATE TABLE oc_assignment_produtos, contagens, oc_localizacoes, oc_produtos,
      oc_assignments, oc_items, ocs, user_empresas, audit_logs, users, empresas
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
    INSERT INTO users (nome, login, senha, role, nivel_estoquista) VALUES
      ('Gestor A', 'gestor-a-test', 'hash', 'gestor', NULL),
      ('Gestor B', 'gestor-b-test', 'hash', 'gestor', NULL),
      ('Anterior', 'anterior-test', 'hash', 'estoquista', 1),
      ('Novo A', 'novo-a-test', 'hash', 'estoquista', 2),
      ('Novo B', 'novo-b-test', 'hash', 'estoquista', 1),
      ('Concorrente B', 'concorrente-b-test', 'hash', 'estoquista', 1),
      ('Concorrente C', 'concorrente-c-test', 'hash', 'estoquista', 1)
    RETURNING id, login
  `)).rows;
  const byLogin = Object.fromEntries(users.map((user) => [user.login, user.id]));
  await pool.query(
    `INSERT INTO user_empresas (user_id, empresa_id) VALUES
      ($1, $2), ($3, $4), ($5, $2), ($6, $2), ($7, $4), ($8, $2), ($9, $2)`,
    [byLogin['gestor-a-test'], empresaA.id, byLogin['gestor-b-test'], empresaB.id,
      byLogin['anterior-test'], byLogin['novo-a-test'], byLogin['novo-b-test'],
      byLogin['concorrente-b-test'], byLogin['concorrente-c-test']]
  );
  return { empresaA, empresaB, byLogin };
}

async function createNewModelOc(repository, fixture, options = {}) {
  const empresa = options.empresa || fixture.empresaA;
  const gestorId = options.gestorId || fixture.byLogin['gestor-a-test'];
  const estoquistaId = options.estoquistaId || fixture.byLogin['anterior-test'];
  const productCount = options.productCount || 2;
  return repository.withTransaction(async (transactionRepository) => {
    const identity = await transactionRepository.getNextIdentity();
    const oc = await transactionRepository.createOc({
      id: identity.nextId, codigo: identity.codigo, gestorId, estoquistaId,
      empresaId: empresa.id, status: OC_STATUS.open
    });
    const products = [];
    const locations = [];
    for (let index = 1; index <= productCount; index += 1) {
      const product = await transactionRepository.createOcProduto({
        ocId: oc.id, produtoExternoId: `EXT-${empresa.id}-${oc.id}-${index}`,
        codigo: `PROD-${empresa.id}-${oc.id}-${index}`, codigoBarras: `789${oc.id}${index}`,
        descricaoSnapshot: `Produto ${index} Empresa ${empresa.id}`,
        saldoSistemaSnapshot: index * 10, status: 'pendente'
      });
      products.push(product);
      locations.push(await transactionRepository.createOcLocalizacao({
        ocProdutoId: product.id, localizacaoExternaId: `LOC-${empresa.id}-${oc.id}-${index}`,
        enderecoSnapshot: `RUA-${index}`, codigoBarrasSnapshot: `LOC-BAR-${oc.id}-${index}`,
        validadeSnapshot: '2030-01-01', status: 'pendente'
      }));
    }
    const assignment = await transactionRepository.createOcAssignment({
      ocId: oc.id, ciclo: 1, fase: 'contagem', estoquistaId, status: 'ativo'
    });
    await transactionRepository.createOcAssignmentProdutos({
      assignmentId: assignment.id, ocId: oc.id,
      ocProdutoIds: products.map((product) => product.id)
    });
    return { oc, products, locations, assignment };
  });
}

async function countLocation(repository, created, index, userId, quantidade, lote, assignment = created.assignment) {
  return repository.createNewModelCount({
    ocId: created.oc.id, ocProdutoId: created.products[index].id,
    ocLocalizacaoId: created.locations[index].id, assignmentId: assignment.id,
    quantidade, lote, userId
  });
}

describe('PostgreSQL integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it('commits domain mutation and audit log in the same PostgreSQL transaction', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const identity = await repository.getNextIdentity();
    await repository.withTransaction(async (transactionRepository, transactionClient) => {
      await transactionRepository.createOc({
        id: identity.nextId, codigo: identity.codigo,
        gestorId: fixture.byLogin['gestor-a-test'], estoquistaId: fixture.byLogin['anterior-test'],
        empresaId: fixture.empresaA.id, status: OC_STATUS.open
      });
      await audit.logAction({
        user: { id: fixture.byLogin['gestor-a-test'], role: 'gestor' },
        action: 'oc.created', entityType: 'oc', entityId: identity.nextId,
        metadata: { empresa_id: fixture.empresaA.id }, transactionClient
      });
    });
    await expect(repository.findOcById(identity.nextId)).resolves.toBeTruthy();
    const logs = await pool.query("SELECT action FROM audit_logs WHERE entity_type = 'oc' AND entity_id = $1", [String(identity.nextId)]);
    expect(logs.rows).toEqual([{ action: 'oc.created' }]);
  });

  it('rolls back domain mutation when the PostgreSQL audit insert fails', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const identity = await repository.getNextIdentity();
    await expect(repository.withTransaction(async (transactionRepository, transactionClient) => {
      await transactionRepository.createOc({
        id: identity.nextId, codigo: identity.codigo,
        gestorId: fixture.byLogin['gestor-a-test'], estoquistaId: fixture.byLogin['anterior-test'],
        empresaId: fixture.empresaA.id, status: OC_STATUS.open
      });
      await audit.logAction({ action: null, entityType: 'oc', entityId: identity.nextId, transactionClient });
    })).rejects.toMatchObject({ code: '23502' });
    await expect(repository.findOcById(identity.nextId)).resolves.toBeNull();
    const logs = await pool.query('SELECT COUNT(*)::int AS total FROM audit_logs WHERE entity_id = $1', [String(identity.nextId)]);
    expect(logs.rows[0].total).toBe(0);
  });

  it('does not persist an audit log when the domain mutation fails', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const identity = await repository.getNextIdentity();
    await expect(repository.withTransaction(async (transactionRepository, transactionClient) => {
      await transactionRepository.createOc({
        id: identity.nextId, codigo: identity.codigo,
        gestorId: fixture.byLogin['gestor-a-test'], estoquistaId: fixture.byLogin['anterior-test'],
        empresaId: fixture.empresaA.id, status: OC_STATUS.open
      });
      await transactionRepository.createOc({
        id: identity.nextId, codigo: identity.codigo,
        gestorId: fixture.byLogin['gestor-a-test'], estoquistaId: fixture.byLogin['anterior-test'],
        empresaId: fixture.empresaA.id, status: OC_STATUS.open
      });
      await audit.logAction({ action: 'oc.created', entityType: 'oc', entityId: identity.nextId, transactionClient });
    })).rejects.toMatchObject({ code: '23505' });
    await expect(repository.findOcById(identity.nextId)).resolves.toBeNull();
    const logs = await pool.query('SELECT COUNT(*)::int AS total FROM audit_logs WHERE entity_id = $1', [String(identity.nextId)]);
    expect(logs.rows[0].total).toBe(0);
  });

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

  it('isolates manager listings and returns assignment, progress and supported filters', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const active = await createNewModelOc(repository, fixture);
    const foreign = await createNewModelOc(repository, fixture, {
      empresa: fixture.empresaB, gestorId: fixture.byLogin['gestor-b-test'],
      estoquistaId: fixture.byLogin['novo-b-test'], productCount: 1
    });
    await countLocation(repository, active, 0, fixture.byLogin['anterior-test'], 7, 'LOTE-A');

    const rows = await repository.listByGestor({ empresaId: fixture.empresaA.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: active.oc.id, codigo: active.oc.codigo, status: OC_STATUS.open,
      empresa_id: fixture.empresaA.id, empresa_codigo: 'TEST_A',
      assignment_id: active.assignment.id,
      responsavel_atual_id: fixture.byLogin['anterior-test'],
      total_localizacoes: 2, localizacoes_contadas: 1
    });
    expect(rows.some((row) => row.id === foreign.oc.id)).toBe(false);
    await expect(repository.listByGestor({
      empresaId: fixture.empresaA.id,
      exportFilters: { search: active.oc.codigo, status: 'em_contagem' }
    })).resolves.toEqual([expect.objectContaining({ id: active.oc.id })]);
    await expect(repository.listByGestor({
      empresaId: fixture.empresaA.id, exportFilters: { search: foreign.oc.codigo }
    })).resolves.toEqual([]);
  });

  it('lists only active work assigned to the stock keeper in the selected company', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const own = await createNewModelOc(repository, fixture);
    await createNewModelOc(repository, fixture, { estoquistaId: fixture.byLogin['novo-a-test'] });
    await createNewModelOc(repository, fixture, {
      empresa: fixture.empresaB, gestorId: fixture.byLogin['gestor-b-test'],
      estoquistaId: fixture.byLogin['anterior-test']
    });
    await countLocation(repository, own, 0, fixture.byLogin['anterior-test'], 9, 'OWN');
    const rows = await repository.listByEstoquista({
      estoquistaId: fixture.byLogin['anterior-test'], empresaId: fixture.empresaA.id,
      itemStatus: ITEM_STATUS, ocStatus: OC_STATUS
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: own.oc.id, empresa_id: fixture.empresaA.id, empresa_codigo: 'TEST_A',
      estoquista_nome: 'Anterior', qtd: 2, qtd_contados: 1
    });
  });

  it('persists the complete OC graph atomically and rolls back on a constraint failure', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const created = await createNewModelOc(repository, fixture);
    await expect(repository.findOcById(created.oc.id)).resolves.toMatchObject({
      codigo: created.oc.codigo, empresa_id: fixture.empresaA.id, empresa_codigo: 'TEST_A'
    });
    await expect(repository.listOperationalProducts({
      ocId: created.oc.id, assignmentId: created.assignment.id
    })).resolves.toHaveLength(2);
    await expect(repository.listOperationalLocationsByProduct({
      ocProdutoId: created.products[0].id, assignmentId: created.assignment.id
    })).resolves.toEqual([expect.objectContaining({
      id: created.locations[0].id, endereco: 'RUA-1', status: 'pendente'
    })]);

    const identity = await repository.getNextIdentity();
    await expect(repository.withTransaction(async (transactionRepository) => {
      const oc = await transactionRepository.createOc({
        id: identity.nextId, codigo: identity.codigo,
        gestorId: fixture.byLogin['gestor-a-test'],
        estoquistaId: fixture.byLogin['anterior-test'],
        empresaId: fixture.empresaA.id, status: OC_STATUS.open
      });
      const product = {
        ocId: oc.id, produtoExternoId: 'ROLLBACK-DUPLICATE', codigo: 'ROLLBACK',
        codigoBarras: null, descricaoSnapshot: 'Rollback',
        saldoSistemaSnapshot: 1, status: 'pendente'
      };
      await transactionRepository.createOcProduto(product);
      await transactionRepository.createOcProduto(product);
    })).rejects.toMatchObject({ code: '23505' });
    await expect(repository.findOcById(identity.nextId)).resolves.toBeNull();
    const leftovers = await pool.query(
      `SELECT (SELECT COUNT(*) FROM oc_produtos WHERE oc_id = $1)::int AS produtos,
        (SELECT COUNT(*) FROM oc_localizacoes l JOIN oc_produtos p ON p.id = l.oc_produto_id WHERE p.oc_id = $1)::int AS localizacoes,
        (SELECT COUNT(*) FROM oc_assignments WHERE oc_id = $1)::int AS assignments,
        (SELECT COUNT(*) FROM oc_assignment_produtos WHERE oc_id = $1)::int AS assignment_produtos`,
      [identity.nextId]
    );
    expect(leftovers.rows[0]).toEqual({
      produtos: 0, localizacoes: 0, assignments: 0, assignment_produtos: 0
    });
  });

  it('persists counting and exposes finalize, approval and history contracts', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const created = await createNewModelOc(repository, fixture);
    await expect(repository.getNewModelFinalizeValidation({
      ocId: created.oc.id, assignmentId: created.assignment.id
    })).resolves.toMatchObject({ oc_existe: true, qtd_ativos: 2, qtd_contados: 0 });
    for (let index = 0; index < 2; index += 1) {
      const count = await countLocation(
        repository, created, index, fixture.byLogin['anterior-test'], 11 + index, `LOTE-${index + 1}`
      );
      expect(count).toMatchObject({
        assignment_id: created.assignment.id, user_id: fixture.byLogin['anterior-test'],
        quantidade: 11 + index, lote: `LOTE-${index + 1}`
      });
      expect(count.created_at).toBeTruthy();
    }
    await expect(repository.getNewModelFinalizeValidation({
      ocId: created.oc.id, assignmentId: created.assignment.id
    })).resolves.toMatchObject({ oc_existe: true, qtd_ativos: 2, qtd_contados: 2 });
    const finalized = await repository.finalizeAssignment({ assignmentId: created.assignment.id });
    expect(finalized).toMatchObject({ status: 'finalizado' });
    expect(finalized.finalizado_em).toBeTruthy();
    await repository.updateOcStatus({ ocId: created.oc.id, status: OC_STATUS.waitingApproval });
    await expect(repository.getNewModelApprovalValidation({ ocId: created.oc.id }))
      .resolves.toMatchObject({ oc_existe: true, has_active_assignment: false, qtd_ativos: 2, qtd_contados: 2 });
    const approval = await repository.listAdminApprovalProducts({ ocId: created.oc.id });
    expect(approval).toHaveLength(2);
    expect(approval[0]).toMatchObject({
      oc_produto_id: created.products[0].id, saldo_contado_vigente: 11,
      total_contagens: 1, primeira_contagem_user_id: fixture.byLogin['anterior-test']
    });
    expect(approval[0].localizacoes[0]).toMatchObject({ saldo_contado: 11, lote: 'LOTE-1' });
  });

  it('scopes partial recount to selected products and preserves both cycles in history', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const created = await createNewModelOc(repository, fixture);
    await countLocation(repository, created, 0, fixture.byLogin['anterior-test'], 10, 'C1-0');
    await countLocation(repository, created, 1, fixture.byLogin['anterior-test'], 11, 'C1-1');
    await repository.finalizeAssignment({ assignmentId: created.assignment.id });

    const recount = await repository.withTransaction(async (transactionRepository) => {
      const assignment = await transactionRepository.createOcAssignment({
        ocId: created.oc.id, ciclo: await transactionRepository.getNextAssignmentCycle({ ocId: created.oc.id }),
        fase: 'recontagem', estoquistaId: fixture.byLogin['novo-a-test'], status: 'ativo'
      });
      await transactionRepository.createOcAssignmentProdutos({
        assignmentId: assignment.id, ocId: created.oc.id,
        ocProdutoIds: [created.products[0].id]
      });
      return assignment;
    });
    await expect(repository.listOperationalProducts({ ocId: created.oc.id, assignmentId: recount.id }))
      .resolves.toEqual([expect.objectContaining({
        id: created.products[0].id, total_localizacoes: 1, localizacoes_contadas: 0
      })]);
    await expect(repository.listOperationalLocationsByProduct({
      ocProdutoId: created.products[1].id, assignmentId: recount.id
    })).resolves.toEqual([]);
    await countLocation(repository, created, 0, fixture.byLogin['novo-a-test'], 13, 'C2', recount);
    await repository.finalizeAssignment({ assignmentId: recount.id });

    const cycles = await repository.listOcAssignments({ ocId: created.oc.id });
    expect(cycles).toEqual([
      expect.objectContaining({
        ciclo: 1, fase: 'contagem', status: 'finalizado',
        produto_ids: created.products.map((product) => product.id)
      }),
      expect.objectContaining({
        ciclo: 2, fase: 'recontagem', status: 'finalizado',
        estoquista_id: fixture.byLogin['novo-a-test'], produto_ids: [created.products[0].id]
      })
    ]);
    const history = await repository.listAdminApprovalProducts({ ocId: created.oc.id });
    expect(history[0]).toMatchObject({ saldo_contado_vigente: 13, total_contagens: 2 });
    expect(history[0].localizacoes[0].contagens.map(({ ciclo, fase, quantidade, lote }) => (
      { ciclo, fase, quantidade, lote }
    ))).toEqual([
      { ciclo: 1, fase: 'contagem', quantidade: 10, lote: 'C1-0' },
      { ciclo: 2, fase: 'recontagem', quantidade: 13, lote: 'C2' }
    ]);
    expect(history[1]).toMatchObject({ saldo_contado_vigente: 11, total_contagens: 1 });
  });

  it('returns empty contracts and rejects an assignment/product link across OCs', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    await expect(repository.findOcById(999999)).resolves.toBeNull();
    await expect(repository.findActiveAssignmentByOc({ ocId: 999999 })).resolves.toBeNull();
    await expect(repository.listByGestor({ empresaId: fixture.empresaA.id })).resolves.toEqual([]);
    const first = await createNewModelOc(repository, fixture, { productCount: 1 });
    const second = await createNewModelOc(repository, fixture, { productCount: 1 });
    await expect(repository.createOcAssignmentProdutos({
      assignmentId: first.assignment.id, ocId: first.oc.id,
      ocProdutoIds: [second.products[0].id]
    })).rejects.toMatchObject({ code: '23503' });
  });

  it('isolates membership and resolves concurrent reassignment with one persisted winner', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const empresaRepository = createEmpresaRepository(pool);
    const created = await createNewModelOc(repository, fixture);
    await expect(empresaRepository.userHasEmpresaAccess(
      fixture.byLogin['novo-b-test'], fixture.empresaA.id
    )).resolves.toBe(false);
    await expect(empresaRepository.userHasEmpresaAccess(
      fixture.byLogin['novo-b-test'], fixture.empresaB.id
    )).resolves.toBe(true);
    const input = {
      assignmentId: created.assignment.id, ocId: created.oc.id,
      previousEstoquistaId: fixture.byLogin['anterior-test']
    };
    const results = await Promise.all([
      repository.reassignActiveAssignment({ ...input, novoEstoquistaId: fixture.byLogin['novo-a-test'] }),
      repository.reassignActiveAssignment({ ...input, novoEstoquistaId: fixture.byLogin['novo-b-test'] })
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const persisted = await repository.findActiveAssignmentByOc({ ocId: created.oc.id });
    expect([fixture.byLogin['novo-a-test'], fixture.byLogin['novo-b-test']])
      .toContain(persisted.estoquista_id);
    await expect(repository.listByGestor({ empresaId: fixture.empresaA.id }))
      .resolves.toEqual([expect.objectContaining({ responsavel_atual_id: persisted.estoquista_id })]);
  });

  it('allows exactly one concurrent reassignment through the service', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const service = createOcService({ repository, audit });
    const created = await createNewModelOc(repository, fixture);
    const initialEstoquistaId = fixture.byLogin['anterior-test'];
    const candidateIds = [
      fixture.byLogin['concorrente-b-test'],
      fixture.byLogin['concorrente-c-test']
    ];
    const input = {
      user: { id: fixture.byLogin['gestor-a-test'], role: 'gestor' },
      empresaId: fixture.empresaA.id,
      ocId: created.oc.id,
      assignmentId: created.assignment.id
    };

    const results = await Promise.allSettled(candidateIds.map((novoEstoquistaId) => (
      service.reassignAssignment({ ...input, novoEstoquistaId })
    )));

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(fulfilled[0].value.changed).toBe(true);
    expect(rejected[0].reason).toMatchObject({
      statusCode: 409,
      message: 'Assignment foi alterado por outra operacao'
    });

    const winningEstoquistaId = fulfilled[0].value.assignment.estoquista_id;

    const persisted = await repository.findActiveAssignmentByOc({ ocId: created.oc.id });
    const logs = await pool.query(
      `SELECT metadata FROM audit_logs
       WHERE action = 'oc.assignment_reassigned' AND entity_type = 'oc' AND entity_id = $1
       ORDER BY id`,
      [String(created.oc.id)]
    );
    expect(logs.rows).toHaveLength(1);
    expect(logs.rows[0].metadata).toEqual(expect.objectContaining({
      assignment_id: created.assignment.id,
      ciclo: 1,
      fase: 'contagem',
      estoquista_anterior_id: initialEstoquistaId,
      estoquista_novo_id: winningEstoquistaId,
      progresso: `${fulfilled[0].value.progresso.counted}/${fulfilled[0].value.progresso.total}`
    }));
    expect(candidateIds).toContain(winningEstoquistaId);
    expect(persisted.estoquista_id).toBe(winningEstoquistaId);
  });

  it('rolls back reassignment when the PostgreSQL audit insert fails', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const failingAudit = {
      logAction: jest.fn((params) => audit.logAction({ ...params, action: null }))
    };
    const service = createOcService({ repository, audit: failingAudit });
    const created = await createNewModelOc(repository, fixture);
    const previousEstoquistaId = fixture.byLogin['anterior-test'];
    const novoEstoquistaId = fixture.byLogin['concorrente-b-test'];

    const readState = async () => {
      const [assignment, progress, audits] = await Promise.all([
        pool.query(
          `SELECT id, oc_id, ciclo, fase, estoquista_id, status, created_at, finalizado_em
           FROM oc_assignments
           WHERE id = $1`,
          [created.assignment.id]
        ),
        pool.query(
          `SELECT COUNT(l.id)::int AS total,
             COUNT(c.id) FILTER (WHERE c.id IS NOT NULL)::int AS counted
           FROM oc_assignment_produtos ap
           JOIN oc_localizacoes l ON l.oc_produto_id = ap.oc_produto_id
           LEFT JOIN contagens c
             ON c.assignment_id = ap.assignment_id
            AND c.oc_localizacao_id = l.id
           WHERE ap.assignment_id = $1`,
          [created.assignment.id]
        ),
        pool.query(
          `SELECT id, user_id, action, entity_type, entity_id, metadata
           FROM audit_logs
           WHERE entity_type = 'oc' AND entity_id = $1
           ORDER BY id`,
          [String(created.oc.id)]
        )
      ]);
      return {
        assignment: assignment.rows[0],
        progress: progress.rows[0],
        audits: audits.rows
      };
    };

    const before = await readState();
    expect(before).toEqual({
      assignment: {
        id: created.assignment.id,
        oc_id: created.oc.id,
        ciclo: 1,
        fase: 'contagem',
        estoquista_id: previousEstoquistaId,
        status: 'ativo',
        created_at: expect.any(Date),
        finalizado_em: null
      },
      progress: { total: 2, counted: 0 },
      audits: []
    });

    let successResponse;
    await expect(service.reassignAssignment({
      user: { id: fixture.byLogin['gestor-a-test'], role: 'gestor' },
      empresaId: fixture.empresaA.id,
      ocId: created.oc.id,
      assignmentId: created.assignment.id,
      novoEstoquistaId,
      auditContext: {}
    }).then((response) => {
      successResponse = response;
      return response;
    })).rejects.toMatchObject({ code: '23502' });

    expect(successResponse).toBeUndefined();
    expect(failingAudit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.assignment_reassigned',
      transactionClient: expect.objectContaining({ query: expect.any(Function) }),
      metadata: expect.objectContaining({
        assignment_id: created.assignment.id,
        ciclo: 1,
        fase: 'contagem',
        estoquista_anterior_id: previousEstoquistaId,
        estoquista_novo_id: novoEstoquistaId,
        progresso: '0/2'
      })
    }));

    const after = await readState();
    expect(after).toEqual(before);
    expect(after.assignment.estoquista_id).toBe(previousEstoquistaId);
    expect(after.assignment.estoquista_id).not.toBe(novoEstoquistaId);
    expect(after.assignment.status).toBe('ativo');
    expect(after.assignment.ciclo).toBe(1);
    expect(after.assignment.fase).toBe('contagem');
    expect(after.audits.some((log) => log.action === 'oc.assignment_reassigned')).toBe(false);
  });

  it('characterizes concurrent recount requests through the service', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const service = createOcService({ repository, audit });
    const created = await createNewModelOc(repository, fixture);
    const candidateIds = [
      fixture.byLogin['concorrente-b-test'],
      fixture.byLogin['concorrente-c-test']
    ];
    await pool.query(
      'UPDATE users SET nivel_estoquista = 2 WHERE id = ANY($1::int[])',
      [candidateIds]
    );
    await countLocation(repository, created, 0, fixture.byLogin['anterior-test'], 10, 'C1-0');
    await countLocation(repository, created, 1, fixture.byLogin['anterior-test'], 11, 'C1-1');
    await repository.finalizeAssignment({ assignmentId: created.assignment.id });
    await repository.updateOcStatus({ ocId: created.oc.id, status: OC_STATUS.waitingApproval });

    const subset = [created.products[0].id];
    const input = {
      user: { id: fixture.byLogin['gestor-a-test'], role: 'gestor' },
      empresaId: fixture.empresaA.id,
      ocId: created.oc.id,
      itemIds: subset
    };
    const settled = await Promise.allSettled(candidateIds.map((novoEstoquistaId) => (
      service.sendOcToRecount({ ...input, novoEstoquistaId })
    )));
    const outcomes = settled.map((result, index) => ({
      status: result.status,
      requestedEstoquistaId: candidateIds[index],
      value: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? {
        status: result.reason.statusCode,
        code: result.reason.errorCode || result.reason.code,
        message: result.reason.message
      } : undefined
    }));
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');

    expect(fulfilled).toEqual([expect.objectContaining({
      requestedEstoquistaId: expect.any(Number),
      value: { message: 'Itens enviados para recontagem' }
    })]);
    expect(rejected).toEqual([expect.objectContaining({
      requestedEstoquistaId: expect.any(Number),
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'OC nao esta aguardando aprovacao'
      }
    })]);

    const winningEstoquistaId = fulfilled[0].requestedEstoquistaId;
    const persistedOc = await repository.findOcById(created.oc.id);
    const assignments = (await pool.query(
      `SELECT id, ciclo, fase, estoquista_id, status
       FROM oc_assignments
       WHERE oc_id = $1
       ORDER BY ciclo, id`,
      [created.oc.id]
    )).rows;
    const recountAssignments = assignments.filter((assignment) => assignment.fase === 'recontagem');
    const activeAssignments = assignments.filter((assignment) => assignment.status === 'ativo');
    const links = (await pool.query(
      `SELECT assignment_id, oc_produto_id
       FROM oc_assignment_produtos
       WHERE oc_id = $1 AND assignment_id = $2
       ORDER BY oc_produto_id`,
      [created.oc.id, recountAssignments[0]?.id]
    )).rows;
    const audits = (await pool.query(
      `SELECT user_id, metadata
       FROM audit_logs
       WHERE action = 'oc.sent_to_recount' AND entity_type = 'oc' AND entity_id = $1
       ORDER BY id`,
      [String(created.oc.id)]
    )).rows;

    expect(assignments).toHaveLength(2);
    expect(recountAssignments).toEqual([expect.objectContaining({
      ciclo: 2,
      fase: 'recontagem',
      estoquista_id: winningEstoquistaId,
      status: 'ativo'
    })]);
    expect(activeAssignments).toEqual(recountAssignments);
    expect(new Set(assignments.map((assignment) => assignment.ciclo)).size).toBe(assignments.length);
    expect(links).toEqual([{
      assignment_id: recountAssignments[0].id,
      oc_produto_id: subset[0]
    }]);
    expect(audits).toEqual([expect.objectContaining({
      user_id: fixture.byLogin['gestor-a-test'],
      metadata: expect.objectContaining({
        assignment_id: recountAssignments[0].id,
        cycle: 2,
        new_estoquista_id: winningEstoquistaId,
        item_ids: subset
      })
    })]);
    expect(persistedOc.status).toBe(OC_STATUS.open);
  });

  it('rolls back recount mutations when the PostgreSQL audit insert fails', async () => {
    const fixture = await createFixture();
    const repository = createOcRepository(pool);
    const audit = createAuditService({ loggerDependency: { error: jest.fn() } });
    const failingAudit = {
      logAction: jest.fn((params) => audit.logAction({ ...params, action: null }))
    };
    const service = createOcService({ repository, audit: failingAudit });
    const created = await createNewModelOc(repository, fixture);
    await countLocation(repository, created, 0, fixture.byLogin['anterior-test'], 10, 'C1-0');
    await countLocation(repository, created, 1, fixture.byLogin['anterior-test'], 11, 'C1-1');
    await repository.finalizeAssignment({ assignmentId: created.assignment.id });
    await repository.updateOcStatus({ ocId: created.oc.id, status: OC_STATUS.waitingApproval });

    const readState = async () => {
      const [oc, assignments, links, audits] = await Promise.all([
        pool.query('SELECT status FROM ocs WHERE id = $1', [created.oc.id]),
        pool.query(
          `SELECT id, ciclo, fase, status, estoquista_id, finalizado_em
           FROM oc_assignments
           WHERE oc_id = $1
           ORDER BY ciclo, id`,
          [created.oc.id]
        ),
        pool.query(
          `SELECT assignment_id, oc_produto_id
           FROM oc_assignment_produtos
           WHERE oc_id = $1
           ORDER BY assignment_id, oc_produto_id`,
          [created.oc.id]
        ),
        pool.query(
          `SELECT id, user_id, action, entity_type, entity_id, metadata
           FROM audit_logs
           WHERE entity_type = 'oc' AND entity_id = $1
           ORDER BY id`,
          [String(created.oc.id)]
        )
      ]);
      return {
        oc: oc.rows[0],
        assignments: assignments.rows,
        links: links.rows,
        audits: audits.rows
      };
    };

    const before = await readState();
    expect(before).toMatchObject({
      oc: { status: OC_STATUS.waitingApproval },
      assignments: [{
        id: created.assignment.id,
        ciclo: 1,
        fase: 'contagem',
        status: 'finalizado',
        estoquista_id: fixture.byLogin['anterior-test'],
        finalizado_em: expect.any(Date)
      }],
      links: created.products.map((product) => ({
        assignment_id: created.assignment.id,
        oc_produto_id: product.id
      })),
      audits: []
    });

    let successResponse;
    await expect(service.sendOcToRecount({
      user: { id: fixture.byLogin['gestor-a-test'], role: 'gestor' },
      empresaId: fixture.empresaA.id,
      ocId: created.oc.id,
      itemIds: [created.products[0].id],
      novoEstoquistaId: fixture.byLogin['novo-a-test'],
      auditContext: {}
    }).then((response) => {
      successResponse = response;
      return response;
    })).rejects.toMatchObject({ code: '23502' });

    expect(successResponse).toBeUndefined();
    expect(failingAudit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.sent_to_recount',
      transactionClient: expect.objectContaining({ query: expect.any(Function) }),
      metadata: expect.objectContaining({
        cycle: 2,
        new_estoquista_id: fixture.byLogin['novo-a-test'],
        item_ids: [created.products[0].id]
      })
    }));

    const after = await readState();
    expect(after).toEqual(before);
    expect(after.oc.status).toBe(OC_STATUS.waitingApproval);
    expect(after.assignments).toEqual([before.assignments[0]]);
    expect(after.assignments.some((assignment) => assignment.ciclo === 2)).toBe(false);
    expect(after.assignments.some((assignment) => assignment.fase === 'recontagem')).toBe(false);
    expect(after.assignments.some((assignment) => assignment.status === 'ativo')).toBe(false);
    expect(after.assignments.some((assignment) => (
      assignment.estoquista_id === fixture.byLogin['novo-a-test']
    ))).toBe(false);
    expect(after.links).toEqual(before.links);
    expect(after.links.some((link) => (
      link.assignment_id !== created.assignment.id
      && created.products.some((product) => product.id === link.oc_produto_id)
    ))).toBe(false);
    expect(after.audits.some((log) => log.action === 'oc.sent_to_recount')).toBe(false);
  });
});
