const pool = require('../../config/db');
const { assertOcRepository } = require('./IOcRepository');

function createOcRepository(db = pool) {
  function fromClient(client) {
    return createOcRepository(client);
  }

  const repository = {
    async withTransaction(callback) {
      const client = await db.connect();
      const transactionRepository = fromClient(client);

      try {
        await client.query('BEGIN');
        const result = await callback(transactionRepository);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async getNextIdentity() {
      const result = await db.query(
        "SELECT nextval(pg_get_serial_sequence('ocs', 'id')) AS next_id"
      );
      const nextId = Number(result.rows[0].next_id);

      return {
        nextId,
        codigo: `OC-${String(nextId).padStart(5, '0')}`
      };
    },

    async findOcById(ocId, { forUpdate = false } = {}) {
      const result = await db.query(
        `SELECT ocs.id,
                ocs.codigo,
                ocs.gestor_id,
                ocs.estoquista_id,
                ocs.status,
                ocs.empresa_id,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE ocs.id = $1
         ${forUpdate ? 'FOR UPDATE OF ocs' : ''}`,
        [ocId]
      );

      return result.rows[0] || null;
    },

    async findUserById(userId) {
      const result = await db.query(
        `SELECT id, nome, role, nivel_estoquista, ativo
         FROM users
         WHERE id = $1`,
        [userId]
      );

      return result.rows[0] || null;
    },

    async userHasEmpresaAccess(userId, empresaId) {
      const result = await db.query(
        `SELECT 1
         FROM user_empresas
         WHERE user_id = $1
           AND empresa_id = $2
         LIMIT 1`,
        [userId, empresaId]
      );

      return result.rowCount > 0;
    },

    async createOc({ id, codigo, gestorId, estoquistaId, empresaId, status }) {
      const result = await db.query(
        `INSERT INTO ocs (id, codigo, gestor_id, estoquista_id, empresa_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, codigo, gestorId, estoquistaId, empresaId, status]
      );

      return result.rows[0];
    },

    async createOcProduto({
      ocId,
      produtoExternoId,
      codigo,
      codigoBarras,
      descricaoSnapshot,
      saldoSistemaSnapshot,
      status
    }) {
      const result = await db.query(
        `INSERT INTO oc_produtos (
           oc_id,
           produto_externo_id,
           codigo,
           codigo_barras,
           descricao_snapshot,
           saldo_sistema_snapshot,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          ocId,
          produtoExternoId,
          codigo,
          codigoBarras,
          descricaoSnapshot,
          saldoSistemaSnapshot,
          status
        ]
      );

      return result.rows[0];
    },

    async createOcLocalizacao({
      ocProdutoId,
      localizacaoExternaId,
      enderecoSnapshot,
      codigoBarrasSnapshot,
      validadeSnapshot,
      status
    }) {
      const result = await db.query(
        `INSERT INTO oc_localizacoes (
           oc_produto_id,
           localizacao_externa_id,
           endereco_snapshot,
           codigo_barras_snapshot,
           validade_snapshot,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          ocProdutoId,
          localizacaoExternaId,
          enderecoSnapshot,
          codigoBarrasSnapshot,
          validadeSnapshot,
          status
        ]
      );

      return result.rows[0];
    },

    async createOcAssignment({ ocId, ciclo, fase, estoquistaId, status }) {
      const result = await db.query(
        `INSERT INTO oc_assignments (oc_id, ciclo, fase, estoquista_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [ocId, ciclo, fase, estoquistaId, status]
      );

      return result.rows[0];
    },

    async createItem({ ocId, produto, saldoSistema, endereco, codigo, codigoBarras, validade, status }) {
      await db.query(
        `INSERT INTO oc_items (
           oc_id,
           produto,
           saldo_sistema,
           endereco,
           codigo,
           codigo_barras,
           validade,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ocId, produto, saldoSistema, endereco, codigo, codigoBarras, validade, status]
      );
    },

    async listByGestor({ gestorId, empresaId }) {
      const result = await db.query(
        `SELECT ocs.*,
                CASE
                  WHEN COUNT(DISTINCT oc_produtos.id) > 0 THEN COUNT(DISTINCT oc_produtos.id)
                  ELSE COUNT(DISTINCT oc_items.id)
                END::int AS qtd,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome,
                MAX(contagens.created_at) AS ultima_contagem_em
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
         LEFT JOIN oc_produtos ON oc_produtos.oc_id = ocs.id
         LEFT JOIN contagens ON contagens.oc_id = ocs.id
         LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE ocs.gestor_id = $1
           AND ocs.empresa_id = $2
         GROUP BY ocs.id, estoquista.nome, empresas.codigo, empresas.nome
         ORDER BY ocs.id DESC`,
        [gestorId, empresaId]
      );

      return result.rows;
    },

    async listByEstoquista({ estoquistaId, empresaId, itemStatus, ocStatus }) {
      const result = await db.query(
        `SELECT ocs.*,
                CASE
                  WHEN COUNT(DISTINCT oc_localizacoes.id) > 0 THEN COUNT(DISTINCT oc_localizacoes.id)
                  ELSE COUNT(oc_items.id) FILTER (WHERE oc_items.status <> $2)
                END::int AS qtd,
                CASE
                  WHEN COUNT(DISTINCT oc_localizacoes.id) > 0 THEN COUNT(DISTINCT oc_localizacoes.id) FILTER (WHERE oc_localizacoes.status = $3)
                  ELSE COUNT(oc_items.id) FILTER (WHERE oc_items.status = $3)
                END::int AS qtd_contados,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
         LEFT JOIN oc_assignments ON oc_assignments.oc_id = ocs.id
          AND oc_assignments.fase = 'contagem'
          AND oc_assignments.ciclo = 1
          AND oc_assignments.status = 'ativo'
         LEFT JOIN oc_produtos ON oc_produtos.oc_id = ocs.id
         LEFT JOIN oc_localizacoes ON oc_localizacoes.oc_produto_id = oc_produtos.id
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE COALESCE(oc_assignments.estoquista_id, ocs.estoquista_id) = $1
           AND ocs.empresa_id = $4
           AND COALESCE(ocs.status, $5) NOT IN ($6, $7)
         GROUP BY ocs.id, empresas.codigo, empresas.nome
         ORDER BY ocs.id DESC`,
        [
          estoquistaId,
          itemStatus.approved,
          itemStatus.counted,
          empresaId,
          ocStatus.open,
          ocStatus.waitingApproval,
          ocStatus.finalized
        ]
      );

      return result.rows;
    },

    async listApprovalForAdmin({ empresaId, openStatus, waitingApprovalStatus }) {
      const result = await db.query(
        `SELECT ocs.*,
                CASE
                  WHEN COUNT(DISTINCT oc_produtos.id) > 0 THEN COUNT(DISTINCT oc_produtos.id)
                  ELSE COUNT(DISTINCT oc_items.id)
                END::int AS qtd,
                gestor.nome AS gestor_nome,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
         LEFT JOIN oc_produtos ON oc_produtos.oc_id = ocs.id
         LEFT JOIN users gestor ON gestor.id = ocs.gestor_id
         LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE COALESCE(ocs.status, $1) = $2
           AND ocs.empresa_id = $3
         GROUP BY ocs.id, gestor.nome, estoquista.nome, empresas.codigo, empresas.nome
         ORDER BY ocs.id DESC`,
        [openStatus, waitingApprovalStatus, empresaId]
      );

      return result.rows;
    },

    async listApprovalForGestor({ gestorId, empresaId, openStatus, waitingApprovalStatus }) {
      const result = await db.query(
        `SELECT ocs.*,
                CASE
                  WHEN COUNT(DISTINCT oc_produtos.id) > 0 THEN COUNT(DISTINCT oc_produtos.id)
                  ELSE COUNT(DISTINCT oc_items.id)
                END::int AS qtd,
                gestor.nome AS gestor_nome,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
         LEFT JOIN oc_produtos ON oc_produtos.oc_id = ocs.id
         LEFT JOIN users gestor ON gestor.id = ocs.gestor_id
         LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE COALESCE(ocs.status, $1) = $2
           AND ocs.gestor_id = $3
           AND ocs.empresa_id = $4
         GROUP BY ocs.id, gestor.nome, estoquista.nome, empresas.codigo, empresas.nome
         ORDER BY ocs.id DESC`,
        [openStatus, waitingApprovalStatus, gestorId, empresaId]
      );

      return result.rows;
    },

    async approveItems({ ocId, approvedStatus, countedStatus }) {
      await db.query(
        `UPDATE oc_items
         SET status = $2
         WHERE oc_id = $1 AND status IN ($3, $2)`,
        [ocId, approvedStatus, countedStatus]
      );
    },

    async updateOcStatus({ ocId, status }) {
      const result = await db.query(
        'UPDATE ocs SET status = $1 WHERE id = $2 RETURNING *',
        [status, ocId]
      );

      return result.rows[0] || null;
    },

    async updateOcAssignmentAndStatus({ ocId, status, estoquistaId }) {
      const result = await db.query(
        `UPDATE ocs
         SET status = $1, estoquista_id = $2
         WHERE id = $3
         RETURNING *`,
        [status, estoquistaId, ocId]
      );

      return result.rows[0] || null;
    },

    async findItemsByIdsForUpdate(itemIds) {
      const result = await db.query(
        `SELECT *
         FROM oc_items
         WHERE id = ANY($1::int[])
         FOR UPDATE`,
        [itemIds]
      );

      return result.rows;
    },

    async markItemsForRecount({ ocId, itemIds, recountStatus }) {
      await db.query(
        `UPDATE oc_items
         SET status = $3,
             saldo_contado = NULL,
             lote = NULL,
             diferenca = NULL
         WHERE oc_id = $1 AND id = ANY($2::int[])`,
        [ocId, itemIds, recountStatus]
      );
    },

    async approveItemsExcept({ ocId, itemIds, approvedStatus, countedStatus }) {
      await db.query(
        `UPDATE oc_items
         SET status = $2
         WHERE oc_id = $1
           AND id <> ALL($3::int[])
           AND status IN ($4, $2)`,
        [ocId, approvedStatus, itemIds, countedStatus]
      );
    },

    async listItems(ocId) {
      const result = await db.query(
        `SELECT oc_items.*,
                first_count.user_id AS primeira_contagem_user_id,
                first_user.nome AS primeira_contagem_usuario_nome,
                first_count.created_at AS primeira_contagem_em,
                last_count.user_id AS ultima_contagem_user_id,
                last_user.nome AS ultima_contagem_usuario_nome,
                last_count.created_at AS ultima_contagem_em,
                COALESCE(count_totals.total_contagens, 0)::int AS total_contagens
         FROM oc_items
         LEFT JOIN LATERAL (
           SELECT contagens.user_id, contagens.created_at
           FROM contagens
           WHERE contagens.item_id = oc_items.id
           ORDER BY contagens.created_at ASC, contagens.id ASC
           LIMIT 1
         ) first_count ON true
         LEFT JOIN users first_user ON first_user.id = first_count.user_id
         LEFT JOIN LATERAL (
           SELECT contagens.user_id, contagens.created_at
           FROM contagens
           WHERE contagens.item_id = oc_items.id
           ORDER BY contagens.created_at DESC, contagens.id DESC
           LIMIT 1
         ) last_count ON true
         LEFT JOIN users last_user ON last_user.id = last_count.user_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS total_contagens
           FROM contagens
           WHERE contagens.item_id = oc_items.id
         ) count_totals ON true
         WHERE oc_items.oc_id = $1
         ORDER BY oc_items.id ASC`,
        [ocId]
      );

      return result.rows;
    },

    async findItemById(itemId, { forUpdate = false } = {}) {
      const result = await db.query(
        `SELECT *
         FROM oc_items
         WHERE id = $1
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [itemId]
      );

      return result.rows[0] || null;
    },

    async ocHasNewModel(ocId) {
      const result = await db.query(
        `SELECT EXISTS (
           SELECT 1
           FROM oc_produtos
           WHERE oc_id = $1
         ) AS has_new_model`,
        [ocId]
      );

      return Boolean(result.rows[0]?.has_new_model);
    },

    async listOperationalProducts({ ocId, assignmentId }) {
      const result = await db.query(
        `SELECT oc_produtos.id,
                oc_produtos.descricao_snapshot AS descricao,
                oc_produtos.status,
                COUNT(oc_localizacoes.id)::int AS total_localizacoes,
                COUNT(oc_localizacoes.id) FILTER (WHERE oc_localizacoes.status = 'contado')::int AS localizacoes_contadas
         FROM oc_produtos
         INNER JOIN oc_localizacoes ON oc_localizacoes.oc_produto_id = oc_produtos.id
         WHERE oc_produtos.oc_id = $1
           AND EXISTS (
             SELECT 1
             FROM oc_assignments
             WHERE oc_assignments.id = $2
               AND oc_assignments.oc_id = oc_produtos.oc_id
           )
         GROUP BY oc_produtos.id
         ORDER BY oc_produtos.id ASC`,
        [ocId, assignmentId]
      );

      return result.rows;
    },

    async listOperationalLocationsByProduct({ ocProdutoId, assignmentId }) {
      const result = await db.query(
        `SELECT oc_localizacoes.id,
                oc_localizacoes.oc_produto_id,
                oc_localizacoes.endereco_snapshot AS endereco,
                oc_localizacoes.status,
                own_count.quantidade,
                own_count.lote
         FROM oc_localizacoes
         INNER JOIN oc_produtos ON oc_produtos.id = oc_localizacoes.oc_produto_id
         LEFT JOIN LATERAL (
           SELECT contagens.quantidade, contagens.lote
           FROM contagens
           WHERE contagens.assignment_id = $2
             AND contagens.oc_localizacao_id = oc_localizacoes.id
           ORDER BY contagens.created_at DESC, contagens.id DESC
           LIMIT 1
         ) own_count ON true
         WHERE oc_localizacoes.oc_produto_id = $1
           AND EXISTS (
             SELECT 1
             FROM oc_assignments
             WHERE oc_assignments.id = $2
               AND oc_assignments.oc_id = oc_produtos.oc_id
           )
         ORDER BY oc_localizacoes.id ASC`,
        [ocProdutoId, assignmentId]
      );

      return result.rows;
    },

    async findLocalizacaoContextById(ocLocalizacaoId, { forUpdate = false } = {}) {
      const result = await db.query(
        `SELECT oc_localizacoes.id,
                oc_localizacoes.oc_produto_id,
                oc_localizacoes.endereco_snapshot,
                oc_localizacoes.status,
                oc_produtos.oc_id,
                oc_produtos.codigo,
                oc_produtos.descricao_snapshot,
                ocs.gestor_id,
                ocs.estoquista_id,
                ocs.empresa_id,
                ocs.status AS oc_status
         FROM oc_localizacoes
         INNER JOIN oc_produtos ON oc_produtos.id = oc_localizacoes.oc_produto_id
         INNER JOIN ocs ON ocs.id = oc_produtos.oc_id
         WHERE oc_localizacoes.id = $1
         ${forUpdate ? 'FOR UPDATE OF oc_localizacoes, oc_produtos, ocs' : ''}`,
        [ocLocalizacaoId]
      );

      return result.rows[0] || null;
    },

    async findActiveFirstCountAssignment({ ocId, estoquistaId }, { forUpdate = false } = {}) {
      const result = await db.query(
        `SELECT *
         FROM oc_assignments
         WHERE oc_id = $1
           AND estoquista_id = $2
           AND fase = 'contagem'
           AND ciclo = 1
           AND status = 'ativo'
         ORDER BY id ASC
         LIMIT 1
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [ocId, estoquistaId]
      );

      return result.rows[0] || null;
    },

    async findCountByAssignmentAndLocation({ assignmentId, ocLocalizacaoId }) {
      const result = await db.query(
        `SELECT *
         FROM contagens
         WHERE assignment_id = $1
           AND oc_localizacao_id = $2
         LIMIT 1`,
        [assignmentId, ocLocalizacaoId]
      );

      return result.rows[0] || null;
    },

    async findLegacyItemForLocalizacao({ ocId, codigo, descricao, endereco }) {
      const result = await db.query(
        `SELECT *
         FROM oc_items
         WHERE oc_id = $1
           AND endereco = $2
           AND (
             ($3::text IS NOT NULL AND codigo = $3)
             OR ($3::text IS NULL AND produto = $4)
           )
         ORDER BY id ASC`,
        [ocId, endereco, codigo || null, descricao]
      );

      return result.rows.length === 1 ? result.rows[0] : null;
    },

    async createNewModelCount({
      ocId,
      ocProdutoId,
      ocLocalizacaoId,
      assignmentId,
      legacyItemId,
      quantidade,
      lote,
      userId
    }) {
      const result = await db.query(
        `INSERT INTO contagens (
           oc_id,
           item_id,
           oc_produto_id,
           oc_localizacao_id,
           assignment_id,
           quantidade,
           lote,
           user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          ocId,
          legacyItemId || null,
          ocProdutoId,
          ocLocalizacaoId,
          assignmentId,
          quantidade,
          lote,
          userId
        ]
      );

      return result.rows[0];
    },

    async updateLocalizacaoStatus({ ocLocalizacaoId, status }) {
      await db.query(
        `UPDATE oc_localizacoes
         SET status = $1
         WHERE id = $2`,
        [status, ocLocalizacaoId]
      );
    },

    async updateProdutoStatusFromLocalizacoes({ ocProdutoId, pendingStatus, countedStatus }) {
      const result = await db.query(
        `UPDATE oc_produtos
         SET status = CASE
           WHEN EXISTS (
             SELECT 1
             FROM oc_localizacoes
             WHERE oc_localizacoes.oc_produto_id = oc_produtos.id
               AND oc_localizacoes.status = $2
           ) THEN $2
           ELSE $3
         END
         WHERE id = $1
         RETURNING *`,
        [ocProdutoId, pendingStatus, countedStatus]
      );

      return result.rows[0] || null;
    },

    async getNewModelFinalizeValidation({ ocId, assignmentId }) {
      const result = await db.query(
        `SELECT EXISTS(SELECT 1 FROM ocs WHERE id = $1) AS oc_existe,
                COUNT(oc_localizacoes.id)::int AS qtd_ativos,
                COUNT(oc_localizacoes.id) FILTER (WHERE oc_localizacoes.status = 'contado')::int AS qtd_contados
         FROM oc_produtos
         INNER JOIN oc_localizacoes ON oc_localizacoes.oc_produto_id = oc_produtos.id
         WHERE oc_produtos.oc_id = $1
           AND EXISTS (
             SELECT 1
             FROM oc_assignments
             WHERE oc_assignments.id = $2
               AND oc_assignments.oc_id = oc_produtos.oc_id
           )`,
        [ocId, assignmentId]
      );

      return result.rows[0];
    },

    async finalizeAssignment({ assignmentId }) {
      const result = await db.query(
        `UPDATE oc_assignments
         SET status = 'finalizado',
             finalizado_em = NOW()
         WHERE id = $1
         RETURNING *`,
        [assignmentId]
      );

      return result.rows[0] || null;
    },

    async createCount({ ocId, itemId, quantidade, lote, userId }) {
      const result = await db.query(
        `INSERT INTO contagens (oc_id, item_id, quantidade, lote, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [ocId, itemId, quantidade, lote, userId]
      );

      return result.rows[0];
    },

    async updateItemCount({ ocId, itemId, quantidade, lote, countedStatus }) {
      await db.query(
        `UPDATE oc_items
         SET saldo_contado = $1,
             lote = $2,
             diferenca = $1 - saldo_sistema,
             status = $3
         WHERE id = $4 AND oc_id = $5`,
        [quantidade, lote, countedStatus, itemId, ocId]
      );
    },

    async getFinalizeValidation({ ocId, approvedStatus, countedStatus }) {
      const result = await db.query(
        `SELECT EXISTS(SELECT 1 FROM ocs WHERE id = $1) AS oc_existe,
                COUNT(id) FILTER (WHERE status <> $2)::int AS qtd_ativos,
                COUNT(id) FILTER (WHERE status = $3)::int AS qtd_contados
         FROM oc_items
         WHERE oc_id = $1`,
        [ocId, approvedStatus, countedStatus]
      );

      return result.rows[0];
    }
  };

  assertOcRepository(repository);
  return repository;
}

module.exports = createOcRepository();
module.exports.createOcRepository = createOcRepository;
