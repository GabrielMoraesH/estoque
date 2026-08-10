const pool = require('../../config/db');

function createEmpresaRepository(db = pool) {
  return {
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
