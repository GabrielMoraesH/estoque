const empresaService = require('./empresaService');
const asyncHandler = require('../../utils/asyncHandler');

function createEmpresaController({ service = empresaService } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const empresas = await service.listEmpresas();
      res.json(empresas);
    })
  };
}

module.exports = createEmpresaController();
module.exports.createEmpresaController = createEmpresaController;
