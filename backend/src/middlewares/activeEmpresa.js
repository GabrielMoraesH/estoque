const empresaService = require('../modules/empresas/empresaService');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

function parseEmpresaId(value) {
  const empresaId = Number(value);

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return null;
  }

  return empresaId;
}

async function requireActiveEmpresa(req, res, next) {
  try {
    const empresaId = parseEmpresaId(req.headers['x-empresa-id']);

    if (!empresaId) {
      throw new AppError('Empresa ativa nao informada', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const empresa = await empresaService.assertUserHasEmpresaAccess(req.user.id, empresaId);

    req.activeEmpresa = empresa;
    req.empresaId = empresa.id;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireActiveEmpresa;
module.exports.requireActiveEmpresa = requireActiveEmpresa;
