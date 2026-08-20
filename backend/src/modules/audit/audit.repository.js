const pool = require('../../config/db');

function createAuditRepository(db = pool) {
  return {
    async create({
      userId,
      userRole,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress,
      userAgent
    }, transactionClient = null) {
      const queryExecutor = transactionClient || db;
      await queryExecutor.query(
        `INSERT INTO audit_logs (
           user_id,
           user_role,
           action,
           entity_type,
           entity_id,
           metadata,
           ip_address,
           user_agent
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          userRole,
          action,
          entityType,
          entityId,
          JSON.stringify(metadata || {}),
          ipAddress,
          userAgent
        ]
      );
    },

    async list({ page, limit, search, action, entityType, empresaId, dateFrom, dateTo }) {
      const conditions = [];
      const params = [];
      const add = (condition, value) => {
        params.push(value);
        conditions.push(condition.replace('?', `$${params.length}`));
      };

      if (search) {
        params.push(search);
        const index = params.length;
        conditions.push(`(users.nome ILIKE '%' || $${index} || '%'
          OR audit_logs.action ILIKE '%' || $${index} || '%'
          OR audit_logs.entity_type ILIKE '%' || $${index} || '%'
          OR audit_logs.entity_id ILIKE '%' || $${index} || '%')`);
      }
      if (action) add('audit_logs.action = ?', action);
      if (entityType) add('audit_logs.entity_type = ?', entityType);
      if (empresaId) add("audit_logs.metadata->>'empresa_id' = ?", String(empresaId));
      if (dateFrom) add('audit_logs.created_at >= ?::date', dateFrom);
      if (dateTo) add("audit_logs.created_at < (?::date + INTERVAL '1 day')", dateTo);

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM audit_logs LEFT JOIN users ON users.id = audit_logs.user_id ${where}`,
        params
      );
      const offset = (page - 1) * limit;
      const dataParams = [...params, limit, offset];
      const result = await db.query(
        `SELECT audit_logs.id, audit_logs.user_id, users.nome AS user_name,
                audit_logs.user_role, audit_logs.action, audit_logs.entity_type,
                audit_logs.entity_id, audit_logs.metadata, audit_logs.created_at,
                empresas.nome AS empresa_name
         FROM audit_logs
         LEFT JOIN users ON users.id = audit_logs.user_id
         LEFT JOIN empresas ON empresas.id = CASE
           WHEN audit_logs.metadata->>'empresa_id' ~ '^[0-9]+$'
           THEN (audit_logs.metadata->>'empresa_id')::int ELSE NULL END
         ${where}
         ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      return { items: result.rows, total: countResult.rows[0].total };
    }
  };
}

module.exports = createAuditRepository();
module.exports.createAuditRepository = createAuditRepository;
