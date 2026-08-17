const pool = require('../../config/db');

function createEmpresaRepository(db = pool) {
  return {
    async listAdmin() {
      const result = await db.query(
        `SELECT empresas.id, empresas.codigo, empresas.nome, empresas.ativo,
                empresas.created_at, empresas.updated_at,
                COUNT(DISTINCT user_empresas.user_id)::int AS usuarios_count,
                COUNT(DISTINCT ocs.id)::int AS ocs_count
         FROM empresas
         LEFT JOIN user_empresas ON user_empresas.empresa_id = empresas.id
         LEFT JOIN ocs ON ocs.empresa_id = empresas.id
         GROUP BY empresas.id
         ORDER BY empresas.nome ASC, empresas.id ASC`
      );

      return result.rows;
    },

    async listActive() {
      const result = await db.query(
        `SELECT id, codigo, nome, ativo, created_at, updated_at
         FROM empresas
         WHERE ativo = true
         ORDER BY nome ASC`
      );

      return result.rows;
    },

    async findActiveById(id) {
      const result = await db.query(
        `SELECT id, codigo, nome, ativo, created_at, updated_at
         FROM empresas
         WHERE id = $1
           AND ativo = true`,
        [id]
      );

      return result.rows[0] || null;
    },

    async findById(id) {
      const result = await db.query(
        `SELECT id, codigo, nome, ativo, created_at, updated_at
         FROM empresas
         WHERE id = $1`,
        [id]
      );

      return result.rows[0] || null;
    },

    async create({ codigo, nome }) {
      const result = await db.query(
        `INSERT INTO empresas (codigo, nome)
         VALUES ($1, $2)
         RETURNING id, codigo, nome, ativo, created_at, updated_at`,
        [codigo, nome]
      );

      return result.rows[0];
    },

    async updateName({ id, nome }) {
      const result = await db.query(
        `UPDATE empresas
         SET nome = $1
         WHERE id = $2
         RETURNING id, codigo, nome, ativo, created_at, updated_at`,
        [nome, id]
      );

      return result.rows[0] || null;
    },

    async updateStatus({ id, ativo }) {
      const result = await db.query(
        `UPDATE empresas
         SET ativo = $1
         WHERE id = $2
         RETURNING id, codigo, nome, ativo, created_at, updated_at`,
        [ativo, id]
      );

      return result.rows[0] || null;
    },

    async listUserEmpresaIds(userId) {
      const result = await db.query(
        `SELECT empresa_id
         FROM user_empresas
         WHERE user_id = $1
         ORDER BY empresa_id ASC`,
        [userId]
      );

      return result.rows.map((row) => row.empresa_id);
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
    }
  };
}

module.exports = createEmpresaRepository();
module.exports.createEmpresaRepository = createEmpresaRepository;
