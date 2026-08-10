const auditService = require('../audit/auditService');
const ocRepository = require('./oc.repository');
const { createOcService } = require('./oc.service');

const ocService = createOcService({
  repository: ocRepository,
  audit: auditService
});

module.exports = ocService;
module.exports.createOcService = createOcService;
