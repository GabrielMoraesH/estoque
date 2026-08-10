const pool = require('../config/db');
const createHttpError = require('../utils/createHttpError');

async function getNextOcIdentity(client = pool) {
  const result = await client.query(
    "SELECT nextval(pg_get_serial_sequence('ocs', 'id')) AS next_id"
  );

  const nextId = Number(result.rows[0].next_id);
  const codigo = `OC-${String(nextId).padStart(5, '0')}`;

  return { nextId, codigo };
}

async function createOc({ gestor_id, estoquista_id }) {
  const { nextId, codigo } = await getNextOcIdentity();

  const result = await pool.query(
    'INSERT INTO ocs (id, codigo, gestor_id, estoquista_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [nextId, codigo, gestor_id, estoquista_id, 'aberta']
  );

  return result.rows[0];
}

async function createOcWithItems({ gestor_id, estoquista_id, items }) {
  const client = await pool.connect();

  try {
    if (!estoquista_id) {
      throw createHttpError(400, 'Selecione um estoquista');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw createHttpError(400, 'Selecione ao menos um produto para gerar a OC');
    }

    await client.query('BEGIN');

    const { nextId, codigo } = await getNextOcIdentity(client);

    const ocResult = await client.query(
      'INSERT INTO ocs (id, codigo, gestor_id, estoquista_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nextId, codigo, gestor_id, estoquista_id, 'aberta']
    );

    const oc = ocResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO oc_items (oc_id, produto, saldo_sistema, status)
         VALUES ($1, $2, $3, 'pendente')`,
        [oc.id, item.produto, item.saldo_sistema]
      );
    }

    await client.query('COMMIT');
    return { ...oc, qtd: items.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listOcsByGestor(id) {
  const result = await pool.query(
    `SELECT ocs.*,
            COUNT(DISTINCT oc_items.id)::int AS qtd,
            estoquista.nome AS estoquista_nome,
            MAX(contagens.created_at) AS ultima_contagem_em
     FROM ocs
     LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
     LEFT JOIN contagens ON contagens.oc_id = ocs.id
     LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
     WHERE ocs.gestor_id = $1
     GROUP BY ocs.id, estoquista.nome
     ORDER BY ocs.id DESC`,
    [id]
  );

  return result.rows;
}

async function listOcsByEstoquista(id) {
  const result = await pool.query(
    `SELECT ocs.*,
            COUNT(oc_items.id)::int AS qtd,
            COUNT(*) FILTER (WHERE oc_items.status = 'contado')::int AS qtd_contados
     FROM ocs
     LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
     WHERE ocs.estoquista_id = $1
       AND COALESCE(ocs.status, 'aberta') NOT IN ('aguardando_aprovacao', 'finalizada')
     GROUP BY ocs.id
     ORDER BY ocs.id DESC`,
    [id]
  );

  return result.rows;
}

async function listApprovalForAdmin() {
  const result = await pool.query(
    `SELECT ocs.*, COUNT(oc_items.id)::int AS qtd,
            gestor.nome AS gestor_nome,
            estoquista.nome AS estoquista_nome
     FROM ocs
     LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
     LEFT JOIN users gestor ON gestor.id = ocs.gestor_id
     LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
     WHERE COALESCE(ocs.status, 'aberta') IN ('aguardando_aprovacao')
     GROUP BY ocs.id, gestor.nome, estoquista.nome
     ORDER BY ocs.id DESC`
  );

  return result.rows;
}

async function listApprovalForGestor(id) {
  const result = await pool.query(
    `SELECT ocs.*, COUNT(oc_items.id)::int AS qtd,
            gestor.nome AS gestor_nome,
            estoquista.nome AS estoquista_nome
     FROM ocs
     LEFT JOIN oc_items ON oc_items.oc_id = ocs.id
     LEFT JOIN users gestor ON gestor.id = ocs.gestor_id
     LEFT JOIN users estoquista ON estoquista.id = ocs.estoquista_id
     WHERE COALESCE(ocs.status, 'aberta') IN ('aguardando_aprovacao')
       AND ocs.gestor_id = $1
     GROUP BY ocs.id, gestor.nome, estoquista.nome
     ORDER BY ocs.id DESC`,
    [id]
  );

  return result.rows;
}

async function approveOc(id) {
  await pool.query(
    `UPDATE oc_items
     SET status = 'aprovado'
     WHERE oc_id = $1 AND status IN ('contado', 'aprovado')`,
    [id]
  );

  await pool.query(
    "UPDATE ocs SET status = 'finalizada' WHERE id = $1",
    [id]
  );

  return { message: 'OC aprovada com sucesso' };
}

async function sendOcToRecount({ id, itemIds }) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw createHttpError(400, 'Selecione ao menos um item para recontagem');
  }

  await pool.query(
    `UPDATE oc_items
     SET status = 'recontar',
         saldo_contado = NULL,
         lote = NULL,
         diferenca = NULL
     WHERE oc_id = $1 AND id = ANY($2::int[])`,
    [id, itemIds]
  );

  await pool.query(
    `UPDATE oc_items
     SET status = 'aprovado'
     WHERE oc_id = $1
       AND id <> ALL($2::int[])
       AND status IN ('contado', 'aprovado')`,
    [id, itemIds]
  );

  await pool.query(
    "UPDATE ocs SET status = 'aberta' WHERE id = $1",
    [id]
  );

  return { message: 'Itens enviados para recontagem' };
}

async function addItemToOc({ id, produto, saldo_sistema }) {
  const result = await pool.query(
    `INSERT INTO oc_items 
     (oc_id, produto, saldo_sistema, status) 
     VALUES ($1, $2, $3, 'pendente') 
     RETURNING *`,
    [id, produto, saldo_sistema]
  );

  return result.rows[0];
}

async function listOcItems(id) {
  const result = await pool.query(
    'SELECT * FROM oc_items WHERE oc_id = $1 ORDER BY id ASC',
    [id]
  );

  return result.rows;
}

async function updateOcItem({ itemId, saldo_contado, lote }) {
  const result = await pool.query(
    `UPDATE oc_items 
     SET saldo_contado = $1,
         lote = $2,
         diferenca = $1 - saldo_sistema,
         status = 'contado'
     WHERE id = $3
     RETURNING *`,
    [saldo_contado, lote, itemId]
  );

  return result.rows[0];
}

async function saveOcCount({ oc_id, item_id, quantidade, lote }) {
  const result = await pool.query(
    `INSERT INTO contagens (oc_id, item_id, quantidade, lote)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [oc_id, item_id, quantidade, lote]
  );

  await pool.query(
    `UPDATE oc_items
     SET saldo_contado = $1,
         lote = $2,
         diferenca = $1 - saldo_sistema,
         status = 'contado'
     WHERE id = $3`,
    [quantidade, lote, item_id]
  );

  return result.rows[0];
}

async function finalizeOc(id) {
  const result = await pool.query(
    "UPDATE ocs SET status = 'aguardando_aprovacao' WHERE id = $1 RETURNING *",
    [id]
  );

  if (result.rows.length === 0) {
    throw createHttpError(404, 'OC n\u00e3o encontrada');
  }

  return { message: 'OC enviada para aprova\u00e7\u00e3o', oc: result.rows[0] };
}

async function listOcCounts(id) {
  const result = await pool.query(
    'SELECT * FROM contagens WHERE oc_id = $1',
    [id]
  );

  return result.rows;
}

module.exports = {
  createOc,
  createOcWithItems,
  listOcsByGestor,
  listOcsByEstoquista,
  listApprovalForAdmin,
  listApprovalForGestor,
  approveOc,
  sendOcToRecount,
  addItemToOc,
  listOcItems,
  updateOcItem,
  saveOcCount,
  finalizeOc,
  listOcCounts
};
