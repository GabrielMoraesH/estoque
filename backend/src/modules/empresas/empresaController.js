const empresaService = require('./empresaService');
const asyncHandler = require('../../utils/asyncHandler');
const { getRequestContext } = require('../../utils/requestContext');

function createEmpresaController({ service = empresaService } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const empresas = await service.listEmpresas();
      res.json(empresas);
    }),
    listActive: asyncHandler(async (req, res) => {
      const empresas = await service.listActiveEmpresas();
      res.json(empresas);
    }),
    create: asyncHandler(async (req, res) => {
      const empresa = await service.createEmpresa({ ...req.body, actor: req.user, auditContext: getRequestContext(req) });
      res.status(201).json(empresa);
    }),
    update: asyncHandler(async (req, res) => {
      const empresa = await service.updateEmpresa({ id: req.params.id, ...req.body, actor: req.user, auditContext: getRequestContext(req) });
      res.json(empresa);
    }),
    updateStatus: asyncHandler(async (req, res) => {
      const empresa = await service.updateEmpresaStatus({ id: req.params.id, ativo: req.body.ativo, actor: req.user, auditContext: getRequestContext(req) });
      res.json(empresa);
    })
  };
}

module.exports = createEmpresaController();
module.exports.createEmpresaController = createEmpresaController;
