const ocService = require('../services/ocService');
const asyncHandler = require('../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const result = await ocService.createOc(req.body);
  res.json(result);
});

const createWithItems = asyncHandler(async (req, res) => {
  const result = await ocService.createOcWithItems(req.body);
  res.json(result);
});

const listByGestor = asyncHandler(async (req, res) => {
  const result = await ocService.listOcsByGestor(req.params.id);
  res.json(result);
});

const listByEstoquista = asyncHandler(async (req, res) => {
  const result = await ocService.listOcsByEstoquista(req.params.id);
  res.json(result);
});

const listApprovalForAdmin = asyncHandler(async (req, res) => {
  const result = await ocService.listApprovalForAdmin();
  res.json(result);
});

const listApprovalForGestor = asyncHandler(async (req, res) => {
  const result = await ocService.listApprovalForGestor(req.params.id);
  res.json(result);
});

const approve = asyncHandler(async (req, res) => {
  const result = await ocService.approveOc(req.params.id);
  res.json(result);
});

const sendToRecount = asyncHandler(async (req, res) => {
  const result = await ocService.sendOcToRecount({
    id: req.params.id,
    itemIds: req.body.itemIds
  });
  res.json(result);
});

const addItem = asyncHandler(async (req, res) => {
  const result = await ocService.addItemToOc({
    id: req.params.id,
    ...req.body
  });
  res.json(result);
});

const listItems = asyncHandler(async (req, res) => {
  const result = await ocService.listOcItems(req.params.id);
  res.json(result);
});

const updateItem = asyncHandler(async (req, res) => {
  const result = await ocService.updateOcItem({
    itemId: req.params.itemId,
    ...req.body
  });
  res.json(result);
});

const saveCount = asyncHandler(async (req, res) => {
  const result = await ocService.saveOcCount(req.body);
  res.json(result);
});

const finalize = asyncHandler(async (req, res) => {
  const result = await ocService.finalizeOc(req.params.id);
  res.json(result);
});

const listCounts = asyncHandler(async (req, res) => {
  const result = await ocService.listOcCounts(req.params.id);
  res.json(result);
});

module.exports = {
  create,
  createWithItems,
  listByGestor,
  listByEstoquista,
  listApprovalForAdmin,
  listApprovalForGestor,
  approve,
  sendToRecount,
  addItem,
  listItems,
  updateItem,
  saveCount,
  finalize,
  listCounts
};
