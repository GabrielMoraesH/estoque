const express = require('express');
const router = express.Router();
const ocController = require('../controllers/ocController');
const validateRequest = require('../middlewares/validate');
const {
  createOcSchema,
  createOcWithItemsSchema,
  gestorOcListSchema,
  estoquistaOcListSchema,
  approvalAdminListSchema,
  approvalGestorListSchema,
  approveOcSchema,
  recountOcSchema,
  addItemSchema,
  listItemsSchema,
  updateItemSchema,
  saveCountSchema,
  finalizeOcSchema,
  listCountsSchema
} = require('../validators/ocSchemas');

router.post('/create', validateRequest(createOcSchema), ocController.create);
router.post('/create-with-items', validateRequest(createOcWithItemsSchema), ocController.createWithItems);
router.get('/gestor/:id', validateRequest(gestorOcListSchema), ocController.listByGestor);
router.get('/estoquista/:id', validateRequest(estoquistaOcListSchema), ocController.listByEstoquista);
router.get('/aprovacao/admin/all', validateRequest(approvalAdminListSchema), ocController.listApprovalForAdmin);
router.get('/aprovacao/gestor/:id', validateRequest(approvalGestorListSchema), ocController.listApprovalForGestor);
router.put('/:id/aprovar', validateRequest(approveOcSchema), ocController.approve);
router.put('/:id/recontagem', validateRequest(recountOcSchema), ocController.sendToRecount);
router.post('/:id/add-item', validateRequest(addItemSchema), ocController.addItem);
router.get('/:id/items', validateRequest(listItemsSchema), ocController.listItems);
router.put('/item/:itemId', validateRequest(updateItemSchema), ocController.updateItem);
router.post('/contar', validateRequest(saveCountSchema), ocController.saveCount);
router.put('/:id/finalizar', validateRequest(finalizeOcSchema), ocController.finalize);
router.get('/:id/contagens', validateRequest(listCountsSchema), ocController.listCounts);

module.exports = router;
