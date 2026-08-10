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
        `SELECT id, nome, role
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

    async createItem({ ocId, produto, saldoSistema, status }) {
      await db.query(
        `INSERT INTO oc_items (oc_id, produto, saldo_sistema, status)
         VALUES ($1, $2, $3, $4)`,
        [ocId, produto, saldoSistema, status]
      );
    },

    async listByGestor({ gestorId, empresaId }) {
      const result = await db.query(
        `SELECT ocs.*,
                COUNT(DISTINCT oc_items.id)::int AS qtd,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome,
                MAX(contagens.created_at) AS ultima_contagem_em
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
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
                COUNT(oc_items.id) FILTER (WHERE oc_items.status <> $2)::int AS qtd,
                COUNT(oc_items.id) FILTER (WHERE oc_items.status = $3)::int AS qtd_contados,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
         LEFT JOIN empresas ON empresas.id = ocs.empresa_id
         WHERE ocs.estoquista_id = $1
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
        `SELECT ocs.*, COUNT(oc_items.id)::int AS qtd,
                gestor.nome AS gestor_nome,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
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
        `SELECT ocs.*, COUNT(oc_items.id)::int AS qtd,
                gestor.nome AS gestor_nome,
                estoquista.nome AS estoquista_nome,
                empresas.codigo AS empresa_codigo,
                empresas.nome AS empresa_nome
         FROM ocs
         LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
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
