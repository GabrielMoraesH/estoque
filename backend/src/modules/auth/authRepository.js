const pool = require('../../config/db');

function createAuthRepository(db = pool) {
  return {
    async findCurrentUserById(id) {
      const result = await db.query(
        `SELECT
           users.id,
           users.nome,
           users.role,
           users.nivel_estoquista,
           users.ativo,
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
         LEFT JOIN empresas
           ON empresas.id = user_empresas.empresa_id
          AND empresas.ativo = true
         WHERE users.id = $1
         GROUP BY users.id`,
        [id]
      );

      return result.rows[0] || null;
    }
  };
}

module.exports = createAuthRepository();
module.exports.createAuthRepository = createAuthRepository;
