const { OC_STATUS, ITEM_STATUS } = require('../ocStatus');

function createOcQueryService({
  repository,
  isAdmin,
  isGestor,
  isEstoquista,
  forbidden,
  assertSameUserOrAdmin
}) {
  function listOcsByGestorInternal({ empresaId }) {
    return repository.listByGestor({ empresaId });
  }

  async function listMyGestorOcs({ user, empresaId }) {
    if (!isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    return listOcsByGestorInternal({ empresaId });
  }

  async function listOcsByGestor({ user, gestorId, empresaId }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    void gestorId;
    return listOcsByGestorInternal({ empresaId });
  }

  function listOcsByEstoquistaInternal({ estoquistaId, empresaId }) {
    return repository.listByEstoquista({
      estoquistaId,
      empresaId,
      itemStatus: {
        approved: ITEM_STATUS.APPROVED,
        counted: ITEM_STATUS.COUNTED
      },
      ocStatus: {
        open: OC_STATUS.OPEN,
        waitingApproval: OC_STATUS.WAITING_APPROVAL,
        finalized: OC_STATUS.FINALIZED
      }
    });
  }

  async function listMyEstoquistaOcs({ user, empresaId }) {
    if (!isEstoquista(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    return listOcsByEstoquistaInternal({ estoquistaId: user.id, empresaId });
  }

  async function listOcsByEstoquista({ user, estoquistaId, empresaId }) {
    if (!isAdmin(user) && !isEstoquista(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    assertSameUserOrAdmin(user, estoquistaId);
    return listOcsByEstoquistaInternal({ estoquistaId, empresaId });
  }

  function listApprovalForAdmin({ empresaId }) {
    return repository.listApprovalForAdmin({
      empresaId,
      openStatus: OC_STATUS.OPEN,
      waitingApprovalStatus: OC_STATUS.WAITING_APPROVAL
    });
  }

  function listApprovalForGestorInternal({ empresaId }) {
    return repository.listApprovalForGestor({
      empresaId,
      openStatus: OC_STATUS.OPEN,
      waitingApprovalStatus: OC_STATUS.WAITING_APPROVAL
    });
  }

  async function listMyApprovalOcs({ user, empresaId }) {
    if (isAdmin(user)) {
      return listApprovalForAdmin({ empresaId });
    }

    if (!isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    return listApprovalForGestorInternal({ empresaId });
  }

  async function listApprovalForGestor({ user, gestorId, empresaId }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    assertSameUserOrAdmin(user, gestorId);
    return listApprovalForGestorInternal({ empresaId });
  }

  return {
    listMyGestorOcs,
    listOcsByGestor,
    listMyEstoquistaOcs,
    listOcsByEstoquista,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor
  };
}

module.exports = { createOcQueryService };
