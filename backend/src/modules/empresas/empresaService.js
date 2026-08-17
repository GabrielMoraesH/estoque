const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const empresaRepository = require('./empresaRepository');
const auditService = require('../audit/auditService');

const noopAudit = { async logAction() {} };

function createEmpresaService({ repository = empresaRepository, audit = noopAudit } = {}) {
  async function logAudit(event) {
    try {
      await audit.logAction(event);
    } catch {
      // Auditoria administrativa nao pode desfazer a operacao principal.
    }
  }
  async function listEmpresas() {
    return repository.listAdmin();
  }

  async function listActiveEmpresas() {
    return repository.listActive();
  }

  async function createEmpresa({ codigo, nome, actor, auditContext }) {
    try {
      const empresa = await repository.create({ codigo, nome });
      await logAudit({
        user: actor,
        action: 'empresa.created',
        entityType: 'empresa',
        entityId: empresa.id,
        metadata: { empresa_id: empresa.id, codigo: empresa.codigo },
        auditContext
      });
      return empresa;
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

    const empresa = await repository.updateName({ id, nome });
    await logAudit({
      user: actor,
      action: 'empresa.updated',
      entityType: 'empresa',
      entityId: empresa.id,
      metadata: { empresa_id: empresa.id, codigo: empresa.codigo, campos_alterados: previous.nome === empresa.nome ? [] : ['nome'] },
      auditContext
    });
    return empresa;
  }

  async function updateEmpresaStatus({ id, ativo, actor, auditContext }) {
    const previous = await repository.findById(id);
    if (!previous) {
      throw new AppError('Empresa nao encontrada', 404, ERROR_CODES.NOT_FOUND);
    }

    if (previous.ativo === ativo) {
      return previous;
    }

    const empresa = await repository.updateStatus({ id, ativo });
    await logAudit({
      user: actor,
      action: ativo ? 'empresa.reactivated' : 'empresa.deactivated',
      entityType: 'empresa',
      entityId: empresa.id,
      metadata: { empresa_id: empresa.id, codigo: empresa.codigo, status_anterior: previous.ativo, status_novo: empresa.ativo },
      auditContext
    });
    return empresa;
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
