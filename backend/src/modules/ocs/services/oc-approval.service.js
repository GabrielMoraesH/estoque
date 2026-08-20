const { OC_STATUS, ITEM_STATUS } = require('../ocStatus');

function createOcApprovalService({
  repository,
  audit,
  assertAdministrativeApprovalRole,
  getOcOrFail,
  assertOcEmpresa,
  ensureOcWaitingApproval,
  badRequest,
  notFound
}) {
  async function ensureOcCompleteForApproval(ocId, repo = repository) {
    if (await repo.ocHasNewModel(ocId)) {
      const validation = await repo.getNewModelApprovalValidation({ ocId });

      if (!validation.oc_existe) {
        throw notFound('OC nao encontrada');
      }

      if (validation.has_active_assignment) {
        throw badRequest('OC possui recontagem ativa');
      }

      if (Number(validation.qtd_ativos || 0) === 0) {
        throw badRequest('Nenhum produto disponivel para aprovar esta OC');
      }

      if (Number(validation.qtd_contados || 0) !== Number(validation.qtd_ativos || 0)) {
        throw badRequest('OC possui localizacoes pendentes de contagem');
      }

      return;
    }

    const validation = await repo.getFinalizeValidation({
      ocId,
      approvedStatus: ITEM_STATUS.APPROVED,
      countedStatus: ITEM_STATUS.COUNTED
    });

    if (!validation.oc_existe) {
      throw notFound('OC nao encontrada');
    }

    if (Number(validation.qtd_ativos || 0) === 0) {
      throw badRequest('Nenhum item disponivel para aprovar esta OC');
    }

    if (Number(validation.qtd_contados || 0) !== Number(validation.qtd_ativos || 0)) {
      throw badRequest('OC possui itens pendentes de contagem');
    }
  }

  async function approveOc({ user, empresaId, ocId, auditContext }) {
    assertAdministrativeApprovalRole(user);
    await repository.withTransaction(async (tx, transactionClient) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      ensureOcWaitingApproval(foundOc);
      await ensureOcCompleteForApproval(ocId, tx);

      await tx.approveItems({
        ocId,
        approvedStatus: ITEM_STATUS.APPROVED,
        countedStatus: ITEM_STATUS.COUNTED
      });
      await tx.updateOcStatus({ ocId, status: OC_STATUS.FINALIZED });

      await audit.logAction({
        user,
        action: 'oc.approved',
        entityType: 'oc',
        entityId: ocId,
        metadata: { previous_status: foundOc.status, empresa_id: empresaId, new_status: OC_STATUS.FINALIZED },
        auditContext,
        transactionClient
      });
    });

    return { message: 'OC aprovada com sucesso' };
  }

  return { approveOc };
}

module.exports = { createOcApprovalService };
