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
    }) {
      await db.query(
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
    }
  };
}

module.exports = createAuditRepository();
module.exports.createAuditRepository = createAuditRepository;
