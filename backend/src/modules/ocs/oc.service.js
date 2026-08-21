const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const { assertOcRepository } = require('./IOcRepository');
const {
  OC_STATUS,
  ITEM_STATUS,
  getOcStatus,
  assertOcStatus,
  assertItemStatus
} = require('./ocStatus');
const { filterExportRows, getOperationalExportStatus } = require('./ocExport');
const { createOcExportService, EXPORT_LIMIT, toExportCsvRow } = require('./services/oc-export.service');
const { createOcQueryService } = require('./services/oc-query.service');
const { createOcApprovalService } = require('./services/oc-approval.service');
const { createOcCreationService } = require('./services/oc-creation.service');
const { createOcCountingService } = require('./services/oc-counting.service');
const { createOcFinalizationService } = require('./services/oc-finalization.service');
const { createOcRecountService } = require('./services/oc-recount.service');
const { createOcReassignmentService } = require('./services/oc-reassignment.service');

const noopAudit = {
  async logAction() {}
};

const ASSIGNMENT_STATUS = {
  ACTIVE: 'ativo',
  FINALIZED: 'finalizado'
};
function badRequest(message) {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
}

function conflict(message) {
  return new AppError(message, 409, ERROR_CODES.CONFLICT);
}

function forbidden(message) {
  return new AppError(message, 403, ERROR_CODES.AUTHORIZATION_ERROR);
}

function notFound(message) {
  return new AppError(message, 404, ERROR_CODES.NOT_FOUND);
}

function createOcService({ repository, audit = noopAudit, csvSerializer } = {}) {
  assertOcRepository(repository);

  function isAdmin(user) {
    return user?.role === 'admin';
  }

  function isGestor(user) {
    return user?.role === 'gestor';
  }

  function isEstoquista(user) {
    return user?.role === 'estoquista';
  }

  function assertSameUserOrAdmin(user, targetUserId) {
    if (isAdmin(user)) {
      return;
    }

    if (Number(user.id) !== Number(targetUserId)) {
      throw forbidden('Voce nao tem permissao para acessar dados de outro usuario');
    }
  }

  async function getOcOrFail(ocId, repo = repository, options = {}) {
    const oc = await repo.findOcById(ocId, options);

    if (!oc) {
      throw notFound('OC nao encontrada');
    }

    return oc;
  }

  function assertOcEmpresa(oc, empresaId) {
    if (Number(oc.empresa_id) !== Number(empresaId)) {
      throw notFound('OC nao encontrada');
    }
  }

  const {
    listMyGestorOcs,
    listOcsByGestor,
    listMyEstoquistaOcs,
    listOcsByEstoquista,
    getDashboardSummary,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor,
    listOcItems,
    getOcHistoryDetails
  } = createOcQueryService({
    repository,
    isAdmin,
    isGestor,
    isEstoquista,
    forbidden,
    assertSameUserOrAdmin,
    getOcOrFail,
    assertOcEmpresa,
    assertOcVisibleToUser,
    assignmentStatus: ASSIGNMENT_STATUS
  });

  async function getOcItemOrFail({ ocId, itemId }, repo = repository, options = {}) {
    const item = await repo.findItemById(itemId, options);

    if (!item) {
      throw notFound('Item da OC nao encontrado');
    }

    if (Number(item.oc_id) !== Number(ocId)) {
      throw badRequest('Item nao pertence a esta OC');
    }

    return item;
  }

  async function getUserOrFail(userId, repo = repository) {
    const user = await repo.findUserById(userId);

    if (!user) {
      throw notFound('Usuario nao encontrado');
    }

    return user;
  }

  async function assertEstoquistaExists(estoquistaId, repo = repository) {
    const user = await getUserOrFail(estoquistaId, repo);

    if (user.role !== 'estoquista') {
      throw badRequest('O usuario informado nao e um estoquista');
    }

    return user;
  }

  async function assertEstoquistaAvailableForAssignment(estoquistaId, repo = repository) {
    const user = await assertEstoquistaExists(estoquistaId, repo);

    if (user.ativo === false) {
      throw badRequest('O estoquista informado esta inativo');
    }

    return user;
  }

  async function assertEstoquistaAvailableForFirstCount(estoquistaId, repo = repository) {
    const user = await assertEstoquistaAvailableForAssignment(estoquistaId, repo);

    if (Number(user.nivel_estoquista) !== 1) {
      throw badRequest('A primeira contagem deve ser atribuida a um estoquista nivel 1');
    }

    return user;
  }

  async function assertUserHasEmpresaAccess(userId, empresaId, repo = repository) {
    const hasAccess = await repo.userHasEmpresaAccess(userId, empresaId);

    if (!hasAccess) {
      throw forbidden('Usuario nao tem acesso a esta empresa');
    }
  }

  function assertAdministrativeApprovalRole(user) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }
  }

  function assertEstoquistaOwnership(user, oc) {
    if (!isEstoquista(user) || Number(oc.estoquista_id) !== Number(user.id)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }
  }

  async function assertEstoquistaEligibleForFirstCount(user, empresaId, repo = repository) {
    if (!isEstoquista(user)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }

    const currentUser = await getUserOrFail(user.id, repo);

    if (currentUser.role !== 'estoquista' || currentUser.ativo === false) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }

    if (Number(currentUser.nivel_estoquista) !== 1) {
      throw forbidden('A primeira contagem deve ser executada por um estoquista nivel 1');
    }

    await assertUserHasEmpresaAccess(user.id, empresaId, repo);

    return currentUser;
  }

  async function assertEstoquistaEligibleForAssignment(user, empresaId, assignment, repo = repository) {
    if (!isEstoquista(user)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }

    const currentUser = await getUserOrFail(user.id, repo);

    if (currentUser.role !== 'estoquista' || currentUser.ativo === false) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }

    const requiredLevel = assignment?.fase === 'recontagem' ? 2 : 1;
    const message = assignment?.fase === 'recontagem'
      ? 'A recontagem deve ser executada por um estoquista nivel 2'
      : 'A primeira contagem deve ser executada por um estoquista nivel 1';

    if (Number(currentUser.nivel_estoquista) !== requiredLevel) {
      throw forbidden(message);
    }

    await assertUserHasEmpresaAccess(user.id, empresaId, repo);

    return currentUser;
  }

  function assertOcVisibleToUser(user, oc) {
    if (isAdmin(user)) {
      return;
    }

    if (isGestor(user)) {
      return;
    }

    if (isEstoquista(user) && Number(oc.estoquista_id) === Number(user.id)) {
      return;
    }

    throw forbidden('Voce nao tem permissao para acessar esta OC');
  }

  const { exportOcsCsv } = createOcExportService({
    repository,
    audit,
    csvSerializer,
    isAdmin,
    isGestor,
    forbidden,
    badRequest
  });

  function ensureOcOpen(oc) {
    const status = getOcStatus(oc);

    if (status === OC_STATUS.FINALIZED) {
      throw badRequest('OC ja foi finalizada');
    }

    if (!assertOcStatus(oc, [OC_STATUS.OPEN])) {
      throw badRequest('OC nao esta aberta');
    }
  }

  function ensureOcWaitingApproval(oc) {
    const status = getOcStatus(oc);

    if (status === OC_STATUS.FINALIZED) {
      throw badRequest('OC ja foi finalizada');
    }

    if (!assertOcStatus(oc, [OC_STATUS.WAITING_APPROVAL])) {
      throw badRequest('OC nao esta aguardando aprovacao');
    }
  }

  const { approveOc } = createOcApprovalService({
    repository,
    audit,
    assertAdministrativeApprovalRole,
    getOcOrFail,
    assertOcEmpresa,
    ensureOcWaitingApproval,
    badRequest,
    notFound
  });

  function cleanText(value) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  const { createOcWithItems } = createOcCreationService({
    repository,
    audit,
    isAdmin,
    isGestor,
    badRequest,
    conflict,
    forbidden,
    cleanText,
    assertUserHasEmpresaAccess,
    assertEstoquistaAvailableForFirstCount,
    ocStatus: OC_STATUS,
    itemStatus: ITEM_STATUS,
    assignmentStatus: ASSIGNMENT_STATUS
  });

  const { saveOcCount } = createOcCountingService({
    repository,
    badRequest,
    conflict,
    forbidden,
    notFound,
    cleanText,
    getOcOrFail,
    getOcItemOrFail,
    assertOcEmpresa,
    ensureOcOpen,
    assertEstoquistaOwnership,
    assertEstoquistaEligibleForAssignment,
    assertItemStatus,
    itemStatus: ITEM_STATUS
  });

  const { finalizeOc } = createOcFinalizationService({
    repository,
    audit,
    getOcOrFail,
    assertOcEmpresa,
    ensureOcOpen,
    assertEstoquistaOwnership,
    assertEstoquistaEligibleForAssignment,
    badRequest,
    forbidden,
    notFound,
    ocStatus: OC_STATUS,
    itemStatus: ITEM_STATUS
  });

  const { sendOcToRecount } = createOcRecountService({
    repository,
    audit,
    assertAdministrativeApprovalRole,
    getOcOrFail,
    assertOcEmpresa,
    ensureOcWaitingApproval,
    assertEstoquistaAvailableForAssignment,
    assertUserHasEmpresaAccess,
    assertItemStatus,
    badRequest,
    conflict,
    notFound,
    ocStatus: OC_STATUS,
    itemStatus: ITEM_STATUS,
    assignmentStatus: ASSIGNMENT_STATUS
  });

  const { reassignAssignment } = createOcReassignmentService({
    repository,
    audit,
    assertAdministrativeApprovalRole,
    getOcOrFail,
    assertOcEmpresa,
    getUserOrFail,
    isAdmin,
    isGestor,
    assertUserHasEmpresaAccess,
    assertEstoquistaAvailableForAssignment,
    badRequest,
    conflict,
    forbidden,
    notFound
  });

  return {
    exportOcsCsv,
    createOcWithItems,
    listMyGestorOcs,
    listOcsByGestor,
    listMyEstoquistaOcs,
    listOcsByEstoquista,
    getDashboardSummary,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor,
    approveOc,
    sendOcToRecount,
    reassignAssignment,
    listOcItems,
    getOcHistoryDetails,
    saveOcCount,
    finalizeOc,
    getOcOrFail
  };
}

module.exports = {
  createOcService,
  EXPORT_LIMIT,
  filterExportRows,
  getOperationalExportStatus,
  toExportCsvRow
};
