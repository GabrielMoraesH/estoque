const express = require('express');
const ocController = require('./ocController');
const validate = require('../../middlewares/validate');
const requireActiveEmpresa = require('../../middlewares/activeEmpresa');
const { requireAuth, requireRole } = require('../auth/authMiddleware');
const {
  createOcWithItemsSchema,
  myGestorOcListSchema,
  gestorOcListSchema,
  myEstoquistaOcListSchema,
  estoquistaOcListSchema,
  approvalAdminListSchema,
  myApprovalListSchema,
  approvalGestorListSchema,
  approveOcSchema,
  recountOcSchema,
  listItemsSchema,
  historyDetailsSchema,
  saveCountSchema,
  finalizeOcSchema,
  exportOcSchema
} = require('./ocSchemas');

const router = express.Router();

router.use(requireAuth);
router.use(requireActiveEmpresa);

router.get('/export/csv', requireRole('admin', 'gestor'), validate(exportOcSchema), ocController.exportCsv);
router.post('/create-with-items', requireRole('admin', 'gestor'), validate(createOcWithItemsSchema), ocController.createWithItems);
router.get('/dashboard', requireRole('admin', 'gestor', 'estoquista'), ocController.dashboard);
router.get('/minhas/gestor', requireRole('gestor'), validate(myGestorOcListSchema), ocController.listMyGestorOcs);
router.get('/gestor/:id', requireRole('admin', 'gestor'), validate(gestorOcListSchema), ocController.listByGestor);
router.get('/minhas/estoquista', requireRole('estoquista'), validate(myEstoquistaOcListSchema), ocController.listMyEstoquistaOcs);
router.get('/estoquista/:id', requireRole('admin', 'estoquista'), validate(estoquistaOcListSchema), ocController.listByEstoquista);
router.get('/aprovacao/minhas', requireRole('admin', 'gestor'), validate(myApprovalListSchema), ocController.listMyApprovalOcs);
router.get('/aprovacao/admin/all', requireRole('admin'), validate(approvalAdminListSchema), ocController.listApprovalForAdmin);
router.get('/aprovacao/gestor/:id', requireRole('admin', 'gestor'), validate(approvalGestorListSchema), ocController.listApprovalForGestor);
router.put('/:id/aprovar', requireRole('admin', 'gestor'), validate(approveOcSchema), ocController.approve);
router.put('/:id/recontagem', requireRole('admin', 'gestor'), validate(recountOcSchema), ocController.sendToRecount);
router.get('/historico/:id', requireRole('admin', 'gestor'), validate(historyDetailsSchema), ocController.getHistoryDetails);
router.get('/:id/items', requireRole('admin', 'gestor', 'estoquista'), validate(listItemsSchema), ocController.listItems);
router.post('/contar', requireRole('estoquista'), validate(saveCountSchema), ocController.saveCount);
router.put('/:id/finalizar', requireRole('estoquista'), validate(finalizeOcSchema), ocController.finalize);

module.exports = router;
