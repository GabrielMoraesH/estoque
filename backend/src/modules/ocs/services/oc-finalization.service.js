function createOcFinalizationService({
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
  ocStatus,
  itemStatus
}) {
  async function finalizeOc({ user, empresaId, ocId, auditContext }) {
    const { updatedOc } = await repository.withTransaction(async (tx, transactionClient) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      ensureOcOpen(foundOc);
      const auditedResult = async (currentUpdatedOc, currentValidation) => {
        await audit.logAction({
          user, action: 'oc.finalized', entityType: 'oc', entityId: ocId,
          metadata: {
            previous_status: foundOc.status, empresa_id: empresaId,
            new_status: ocStatus.WAITING_APPROVAL,
            active_item_count: Number(currentValidation.qtd_ativos || 0),
            counted_item_count: Number(currentValidation.qtd_contados || 0)
          },
          auditContext, transactionClient
        });
        return { updatedOc: currentUpdatedOc };
      };

      if (await tx.ocHasNewModel(ocId)) {
        const assignment = await tx.findActiveAssignmentForUser(
          { ocId, estoquistaId: user.id },
          { forUpdate: true }
        );

        if (!assignment) {
          throw forbidden('Voce nao tem assignment ativo para esta OC');
        }

        await assertEstoquistaEligibleForAssignment(user, empresaId, assignment, tx);

        const currentValidation = await tx.getNewModelFinalizeValidation({
          ocId,
          assignmentId: assignment.id
        });

        if (!currentValidation.oc_existe) {
          throw notFound('OC nao encontrada');
        }

        if (Number(currentValidation.qtd_ativos || 0) === 0) {
          throw badRequest('Nenhuma localizacao disponivel para finalizar esta OC');
        }

        if (Number(currentValidation.qtd_contados || 0) !== Number(currentValidation.qtd_ativos || 0)) {
          throw badRequest('Conclua a contagem das localizacoes pendentes');
        }

        await tx.finalizeAssignment({ assignmentId: assignment.id });
        const currentUpdatedOc = await tx.updateOcStatus({
          ocId,
          status: ocStatus.WAITING_APPROVAL
        });

        return auditedResult(currentUpdatedOc, currentValidation);
      }

      assertEstoquistaOwnership(user, foundOc);

      const currentValidation = await tx.getFinalizeValidation({
        ocId,
        approvedStatus: itemStatus.APPROVED,
        countedStatus: itemStatus.COUNTED
      });

      if (!currentValidation.oc_existe) {
        throw notFound('OC nao encontrada');
      }

      if (Number(currentValidation.qtd_ativos || 0) === 0) {
        throw badRequest('Nenhum item disponivel para finalizar esta OC');
      }

      if (Number(currentValidation.qtd_contados || 0) !== Number(currentValidation.qtd_ativos || 0)) {
        throw badRequest('Conclua a contagem dos itens enviados para recontagem');
      }

      const currentUpdatedOc = await tx.updateOcStatus({
        ocId,
        status: ocStatus.WAITING_APPROVAL
      });

      return auditedResult(currentUpdatedOc, currentValidation);
    });

    return { message: 'OC enviada para aprovacao', oc: updatedOc };
  }

  return { finalizeOc };
}

module.exports = { createOcFinalizationService };
