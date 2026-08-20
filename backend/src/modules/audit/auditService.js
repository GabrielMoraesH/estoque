const logger = require('../../utils/logger');
const auditRepository = require('./audit.repository');

const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'password_old', 'password_new',
  'senha', 'senha_hash', 'senha_antiga', 'senha_nova', 'hash',
  'token', 'access_token', 'refresh_token', 'jwt', 'authorization',
  'cookie', 'secret', 'client_secret'
]);
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;
const MAX_STRING_LENGTH = 2000;

function normalizeMetadataKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function isSensitiveMetadataKey(key) {
  return SENSITIVE_KEYS.has(normalizeMetadataKey(key));
}

function sanitizeMetadata(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}[truncated]` : value;
  if (['number', 'boolean'].includes(typeof value)) return value;
  if (typeof value !== 'object' || depth >= MAX_DEPTH) return '[redacted]';
  if (seen.has(value)) return '[circular]';

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '[invalid date]' : value.toISOString();
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeMetadata(item, depth + 1, seen));
  }

  return Object.entries(value).slice(0, MAX_OBJECT_KEYS).reduce((safe, [key, item]) => {
    if (!isSensitiveMetadataKey(key)) {
      safe[key] = sanitizeMetadata(item, depth + 1, seen);
    }
    return safe;
  }, {});
}

function createAuditService({ repository = auditRepository, loggerDependency = logger } = {}) {
  return {
    async list(filters) {
      return repository.list(filters);
    },

    async logAction({ user, action, entityType, entityId = null, metadata = {}, auditContext = {}, transactionClient = null }) {
      try {
        const record = {
          userId: user?.id || null,
          userRole: user?.role || null,
          action,
          entityType,
          entityId: entityId === null || entityId === undefined ? null : String(entityId),
          metadata: sanitizeMetadata(metadata),
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        };
        if (transactionClient) {
          await repository.create(record, transactionClient);
        } else {
          await repository.create(record);
        }
      } catch (err) {
        loggerDependency.error('Erro ao registrar auditoria');
        if (transactionClient) {
          throw err;
        }
      }
    }
  };
}

module.exports = createAuditService();
module.exports.createAuditService = createAuditService;
module.exports.sanitizeMetadata = sanitizeMetadata;
module.exports.isSensitiveMetadataKey = isSensitiveMetadataKey;
