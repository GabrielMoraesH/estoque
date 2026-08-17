const ocService = require('./ocService');
const asyncHandler = require('../../utils/asyncHandler');
const { getRequestContext } = require('../../utils/requestContext');

function createOcController({ service = ocService } = {}) {
  return {
    exportCsv: asyncHandler(async (req, res) => {
      const result = await service.exportOcsCsv({
        user: req.user,
        empresaId: req.empresaId,
        empresa: req.activeEmpresa,
        filters: req.query,
        auditContext: getRequestContext(req)
      });
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.set('Cache-Control', 'no-store');
      res.send(result.csv);
    }),

    createWithItems: asyncHandler(async (req, res) => {
      const result = await service.createOcWithItems({
        user: req.user,
        empresaId: req.empresaId,
        payload: req.body,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    dashboard: asyncHandler(async (req, res) => {
      const result = await service.getDashboardSummary({
        user: req.user,
        empresaId: req.empresaId
      });
      res.json(result);
    }),

    listMyGestorOcs: asyncHandler(async (req, res) => {
      const result = await service.listMyGestorOcs({
        user: req.user,
        empresaId: req.empresaId
      });
      res.json(result);
    }),

    listByGestor: asyncHandler(async (req, res) => {
      const result = await service.listOcsByGestor({
        user: req.user,
        empresaId: req.empresaId,
        gestorId: req.params.id
      });
      res.json(result);
    }),

    listMyEstoquistaOcs: asyncHandler(async (req, res) => {
      const result = await service.listMyEstoquistaOcs({
        user: req.user,
        empresaId: req.empresaId
      });
      res.json(result);
    }),

    listByEstoquista: asyncHandler(async (req, res) => {
      const result = await service.listOcsByEstoquista({
        user: req.user,
        empresaId: req.empresaId,
        estoquistaId: req.params.id
      });
      res.json(result);
    }),

    listApprovalForAdmin: asyncHandler(async (req, res) => {
      const result = await service.listApprovalForAdmin({
        empresaId: req.empresaId
      });
      res.json(result);
    }),

    listMyApprovalOcs: asyncHandler(async (req, res) => {
      const result = await service.listMyApprovalOcs({
        user: req.user,
        empresaId: req.empresaId
      });
      res.json(result);
    }),

    listApprovalForGestor: asyncHandler(async (req, res) => {
      const result = await service.listApprovalForGestor({
        user: req.user,
        empresaId: req.empresaId,
        gestorId: req.params.id
      });
      res.json(result);
    }),

    approve: asyncHandler(async (req, res) => {
      const result = await service.approveOc({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.id,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    sendToRecount: asyncHandler(async (req, res) => {
      const result = await service.sendOcToRecount({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.id,
        itemIds: req.body.itemIds,
        novoEstoquistaId: req.body.novo_estoquista_id,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    reassignAssignment: asyncHandler(async (req, res) => {
      const result = await service.reassignAssignment({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.ocId,
        assignmentId: req.params.assignmentId,
        novoEstoquistaId: req.body.estoquista_id,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    listItems: asyncHandler(async (req, res) => {
      const result = await service.listOcItems({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.id
      });
      res.json(result);
    }),

    getHistoryDetails: asyncHandler(async (req, res) => {
      const result = await service.getOcHistoryDetails({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.id
      });
      res.json(result);
    }),

    saveCount: asyncHandler(async (req, res) => {
      const result = await service.saveOcCount({
        user: req.user,
        empresaId: req.empresaId,
        payload: req.body,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    }),

    finalize: asyncHandler(async (req, res) => {
      const result = await service.finalizeOc({
        user: req.user,
        empresaId: req.empresaId,
        ocId: req.params.id,
        auditContext: getRequestContext(req)
      });
      res.json(result);
    })
  };
}

module.exports = createOcController();
module.exports.createOcController = createOcController;
