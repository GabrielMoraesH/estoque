const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const empresaRepository = require('./empresaRepository');

function createEmpresaService({ repository = empresaRepository } = {}) {
  async function listEmpresas() {
    return repository.listActive();
  }

  async function getUserEmpresaIds(userId) {
    return repository.listUserEmpresaIds(userId);
  }

  async function assertUserHasEmpresaAccess(userId, empresaId) {
    const empresa = await repository.findActiveById(empresaId);

    if (!empresa) {
      throw new AppError('Empresa nao encontrada', 404, ERROR_CODES.NOT_FOUND);
    }

    const hasAccess = await repository.userHasEmpresaAccess(userId, empresaId);

    if (!hasAccess) {
      throw new AppError(
        'Usuario nao tem acesso a esta empresa',
        403,
        ERROR_CODES.AUTHORIZATION_ERROR
      );
    }

    return empresa;
  }

  return {
    listEmpresas,
    getUserEmpresaIds,
    assertUserHasEmpresaAccess
  };
}

module.exports = createEmpresaService();
module.exports.createEmpresaService = createEmpresaService;
