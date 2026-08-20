const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const empresaRepository = require('./empresaRepository');
const auditService = require('../audit/auditService');

const noopAudit = { async logAction() {} };

function createEmpresaService({ repository = empresaRepository, audit = noopAudit } = {}) {
  const withTransaction = repository.withTransaction
    ? repository.withTransaction.bind(repository)
    : async (callback) => callback(repository, {});
  async function listEmpresas() {
    return repository.listAdmin();
  }

  async function listActiveEmpresas() {
    return repository.listActive();
  }

  async function createEmpresa({ codigo, nome, actor, auditContext }) {
    try {
      return await withTransaction(async (transactionRepository, transactionClient) => {
        const empresa = await transactionRepository.create({ codigo, nome });
        await audit.logAction({
          user: actor, action: 'empresa.created', entityType: 'empresa', entityId: empresa.id,
          metadata: { empresa_id: empresa.id, codigo: empresa.codigo }, auditContext, transactionClient
        });
        return empresa;
      });
    } catch (error) {
      if (error.code === '23505') {
        throw new AppError('Codigo de empresa ja existe', 409, ERROR_CODES.CONFLICT);
      }
      throw error;
    }
  }

  async function updateEmpresa({ id, nome, actor, auditContext }) {
    const previous = await repository.findById(id);
    if (!previous) {
      throw new AppError('Empresa nao encontrada', 404, ERROR_CODES.NOT_FOUND);
    }

    if (previous.nome === nome) {
      return previous;
    }

    return withTransaction(async (transactionRepository, transactionClient) => {
      const empresa = await transactionRepository.updateName({ id, nome });
      await audit.logAction({
        user: actor, action: 'empresa.updated', entityType: 'empresa', entityId: empresa.id,
        metadata: { empresa_id: empresa.id, codigo: empresa.codigo, campos_alterados: ['nome'] },
        auditContext, transactionClient
      });
      return empresa;
    });
  }

  async function updateEmpresaStatus({ id, ativo, actor, auditContext }) {
    const previous = await repository.findById(id);
    if (!previous) {
      throw new AppError('Empresa nao encontrada', 404, ERROR_CODES.NOT_FOUND);
    }

    if (previous.ativo === ativo) {
      return previous;
    }

    return withTransaction(async (transactionRepository, transactionClient) => {
      const empresa = await transactionRepository.updateStatus({ id, ativo });
      await audit.logAction({
        user: actor, action: ativo ? 'empresa.reactivated' : 'empresa.deactivated',
        entityType: 'empresa', entityId: empresa.id,
        metadata: { empresa_id: empresa.id, codigo: empresa.codigo, status_anterior: previous.ativo, status_novo: empresa.ativo },
        auditContext, transactionClient
      });
      return empresa;
    });
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
    listActiveEmpresas,
    createEmpresa,
    updateEmpresa,
    updateEmpresaStatus,
    getUserEmpresaIds,
    assertUserHasEmpresaAccess
  };
}

module.exports = createEmpresaService({ repository: empresaRepository, audit: auditService });
module.exports.createEmpresaService = createEmpresaService;
