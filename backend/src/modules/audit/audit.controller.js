const asyncHandler = require('../../utils/asyncHandler');
const auditService = require('./auditService');

function createAuditController({ service = auditService } = {}) {
  return { list: asyncHandler(async (req, res) => {
  const query = req.query;
  const result = await service.list({
    page: query.page,
    limit: query.limit,
    search: query.search,
    action: query.action,
    entityType: query.entity_type,
    empresaId: query.empresa_id,
    dateFrom: query.date_from,
    dateTo: query.date_to
  });
  res.json({ ...result, page: query.page, limit: query.limit, pages: Math.ceil(result.total / query.limit) });
  }) };
}

module.exports = createAuditController();
module.exports.createAuditController = createAuditController;
