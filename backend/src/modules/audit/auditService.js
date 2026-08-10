const logger = require('../../utils/logger');
const auditRepository = require('./audit.repository');

function createAuditService({ repository = auditRepository, loggerDependency = logger } = {}) {
  return {
    async logAction({ user, action, entityType, entityId = null, metadata = {}, auditContext = {} }) {
      try {
        await repository.create({
          userId: user?.id || null,
          userRole: user?.role || null,
          action,
          entityType,
          entityId: entityId === null || entityId === undefined ? null : String(entityId),
          metadata,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        });
      } catch (err) {
        loggerDependency.error('Erro ao registrar auditoria:', err);
      }
    }
  };
}

module.exports = createAuditService();
module.exports.createAuditService = createAuditService;
