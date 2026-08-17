const pool = require('../../config/db');
const { assertUserRepository } = require('./IUserRepository');

function createUserRepository(db = pool) {
  const userSelectFields = `
    users.id,
    users.nome,
    users.login,
    users.role,
    users.nivel_estoquista,
    users.ativo,
    users.created_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', empresas.id,
          'codigo', empresas.codigo,
          'nome', empresas.nome
        )
        ORDER BY empresas.nome ASC
      ) FILTER (WHERE empresas.id IS NOT NULL),
      '[]'::json
    ) AS empresas
  `;

  const repository = {
    async withTransaction(callback) {
      const client = await db.connect();

      try {
        await client.query('BEGIN');
        const result = await callback(createUserRepository(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async create({ nome, login, senha, role, nivel_estoquista }) {
      const result = await db.query(
        `INSERT INTO users (nome, login, senha, role, nivel_estoquista)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nome, login, role, nivel_estoquista, ativo, created_at, '[]'::json AS empresas`,
        [nome, login, senha, role, nivel_estoquista]
      );

      return result.rows[0];
    },

    async findByLogin(login) {
      const result = await db.query(
        'SELECT * FROM users WHERE login = $1',
        [login]
      );

      return result.rows[0] || null;
    },

    async findSummaryById(id) {
      const result = await db.query(
        `SELECT ${userSelectFields}
         FROM users
         LEFT JOIN user_empresas ON user_empresas.user_id = users.id
         LEFT JOIN empresas ON empresas.id = user_empresas.empresa_id
         WHERE users.id = $1
         GROUP BY users.id`,
        [id]
      );

      return result.rows[0] || null;
    },

    async findActiveEmpresaIds(empresaIds) {
      const result = await db.query(
        `SELECT id
         FROM empresas
         WHERE ativo = true
           AND id = ANY($1::int[])
         ORDER BY id ASC`,
        [empresaIds]
      );

      return result.rows.map((row) => row.id);
    },

    async listActiveEmpresasByUserId(userId) {
      const result = await db.query(
        `SELECT empresas.id, empresas.codigo, empresas.nome
         FROM user_empresas
         INNER JOIN empresas ON empresas.id = user_empresas.empresa_id
         WHERE user_empresas.user_id = $1
           AND empresas.ativo = true
         ORDER BY empresas.nome ASC`,
        [userId]
      );

      return result.rows;
    },

    async replaceUserEmpresas(userId, empresaIds) {
      await db.query('DELETE FROM user_empresas WHERE user_id = $1', [userId]);

      if (empresaIds.length === 0) {
        return;
      }

      await db.query(
        `INSERT INTO user_empresas (user_id, empresa_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT DO NOTHING`,
        [userId, empresaIds]
      );
    },

    async list() {
      const result = await db.query(
        `SELECT ${userSelectFields}
         FROM users
         LEFT JOIN user_empresas ON user_empresas.user_id = users.id
         LEFT JOIN empresas ON empresas.id = user_empresas.empresa_id
         GROUP BY users.id
         ORDER BY users.nome ASC`
      );

      return result.rows;
    },

    async update({ id, nome, login, role, nivel_estoquista, senha }) {
      const hasPassword = Boolean(senha);
      const result = await db.query(
        hasPassword
          ? `UPDATE users
             SET nome = $1, login = $2, role = $3, nivel_estoquista = $4, senha = $5
             WHERE id = $6
             RETURNING id, nome, login, role, nivel_estoquista, ativo, created_at, '[]'::json AS empresas`
          : `UPDATE users
             SET nome = $1, login = $2, role = $3, nivel_estoquista = $4
             WHERE id = $5
             RETURNING id, nome, login, role, nivel_estoquista, ativo, created_at, '[]'::json AS empresas`,
        hasPassword
          ? [nome, login, role, nivel_estoquista, senha, id]
          : [nome, login, role, nivel_estoquista, id]
      );

      return result.rows[0] || null;
    },

    async updateStatus({ id, ativo }) {
      const result = await db.query(
        `UPDATE users
         SET ativo = $1
         WHERE id = $2
         RETURNING id, nome, login, role, nivel_estoquista, ativo, created_at, '[]'::json AS empresas`,
        [ativo, id]
      );

      return result.rows[0] || null;
    },

    async deleteById(id) {
      const result = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, nome, login, role, nivel_estoquista',
        [id]
      );

      return result.rows[0] || null;
    },

    async listEstoquistas({ empresaId, nivel } = {}) {
      const params = [];
      const empresaFilter = empresaId
        ? `AND EXISTS (
             SELECT 1
             FROM user_empresas filtro_user_empresas
             WHERE filtro_user_empresas.user_id = users.id
               AND filtro_user_empresas.empresa_id = $1
           )`
        : '';

      if (empresaId) {
        params.push(empresaId);
      }

      const nivelFilter = nivel ? `AND users.nivel_estoquista = $${params.length + 1}` : '';

      if (nivel) {
        params.push(nivel);
      }

      const result = await db.query(
        `SELECT
           users.id,
           users.nome,
           users.role,
           users.ativo,
           users.nivel_estoquista,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', empresas.id,
                 'codigo', empresas.codigo,
                 'nome', empresas.nome
               )
               ORDER BY empresas.nome ASC
             ) FILTER (WHERE empresas.id IS NOT NULL),
             '[]'::json
           ) AS empresas
         FROM users
         LEFT JOIN user_empresas ON user_empresas.user_id = users.id
         LEFT JOIN empresas ON empresas.id = user_empresas.empresa_id
         WHERE users.role = 'estoquista'
           AND users.ativo = true
           ${empresaFilter}
           ${nivelFilter}
         GROUP BY users.id
         ORDER BY users.nome ASC`,
        params
      );

      return result.rows;
    }
  };

  assertUserRepository(repository);
  return repository;
}

module.exports = createUserRepository();
module.exports.createUserRepository = createUserRepository;
