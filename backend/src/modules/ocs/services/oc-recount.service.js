function createOcRecountService({
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
  ocStatus,
  itemStatus,
  assignmentStatus
}) {
  async function assertEstoquistaAvailableForRecount(estoquistaId, empresaId, repo = repository) {
    const user = await assertEstoquistaAvailableForAssignment(estoquistaId, repo);

    if (Number(user.nivel_estoquista) !== 2) {
      throw badRequest('A recontagem deve ser atribuida a um estoquista nivel 2');
    }

    await assertUserHasEmpresaAccess(estoquistaId, empresaId, repo);

    return user;
  }

  function ensureItemAvailableForRecount(item) {
    if (!assertItemStatus(item, [itemStatus.COUNTED, itemStatus.APPROVED])) {
      throw badRequest('Item nao esta disponivel para recontagem');
    }
  }

  async function sendOcToRecount({ user, empresaId, ocId, itemIds, novoEstoquistaId, auditContext }) {
    assertAdministrativeApprovalRole(user);
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw badRequest('Selecione ao menos um item para recontagem');
    }

    if (!novoEstoquistaId) {
      throw badRequest('Selecione o estoquista responsavel pela recontagem');
    }

    const normalizedItemIds = [...new Set(itemIds.map((itemId) => Number(itemId)))];
    const normalizedNovoEstoquistaId = Number(novoEstoquistaId);
    let recountContext = {};
    await repository.withTransaction(async (tx, transactionClient) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      ensureOcWaitingApproval(foundOc);

      if (await tx.ocHasNewModel(ocId)) {
        await assertEstoquistaAvailableForRecount(normalizedNovoEstoquistaId, empresaId, tx);

        const firstAssignment = await tx.findFirstCountAssignment({ ocId }, { forUpdate: true });

        if (!firstAssignment) {
          throw badRequest('Assignment da primeira contagem nao encontrado');
        }

        if (Number(firstAssignment.estoquista_id) === normalizedNovoEstoquistaId) {
          throw badRequest('Selecione um estoquista diferente do responsavel pela primeira contagem');
        }

        const activeAssignment = await tx.findActiveAssignmentByOc({ ocId }, { forUpdate: true });

        if (activeAssignment) {
          throw badRequest('OC ja possui assignment ativo');
        }

        const products = await tx.findOcProdutosByIdsForUpdate({
          ocId,
          ocProdutoIds: normalizedItemIds
        });

        if (products.length !== normalizedItemIds.length) {
          throw notFound('Produto da OC nao encontrado');
        }

        const nextCycle = await tx.getNextAssignmentCycle({ ocId });
        let assignment;

        try {
          assignment = await tx.createOcAssignment({
            ocId,
            ciclo: nextCycle,
            fase: 'recontagem',
            estoquistaId: normalizedNovoEstoquistaId,
            status: assignmentStatus.ACTIVE
          });
        } catch (err) {
          if (err?.code === '23505' && String(err.constraint || '').includes('idx_oc_assignments_active_unique')) {
            throw conflict('OC ja possui assignment ativo');
          }

          if (err?.code === '23505') {
            throw conflict('Nao foi possivel criar o proximo ciclo de recontagem');
          }

          throw err;
        }

        await tx.createOcAssignmentProdutos({
          assignmentId: assignment.id,
          ocId,
          ocProdutoIds: normalizedItemIds
        });

        await tx.updateOcStatus({ ocId, status: ocStatus.OPEN });

        recountContext = { cycle: nextCycle, assignment_id: assignment.id };

        await audit.logAction({
          user, action: 'oc.sent_to_recount', entityType: 'oc', entityId: ocId,
          metadata: {
            previous_status: foundOc.status, empresa_id: empresaId, new_status: ocStatus.OPEN,
            previous_estoquista_id: foundOc.estoquista_id,
            new_estoquista_id: normalizedNovoEstoquistaId, item_ids: normalizedItemIds,
            item_count: normalizedItemIds.length, ...recountContext
          },
          auditContext, transactionClient
        });
        return foundOc;
      }

      await assertEstoquistaAvailableForAssignment(normalizedNovoEstoquistaId, tx);
      await assertUserHasEmpresaAccess(normalizedNovoEstoquistaId, empresaId, tx);

      if (Number(foundOc.estoquista_id) === normalizedNovoEstoquistaId) {
        throw badRequest('Selecione um estoquista diferente do responsavel pela primeira contagem');
      }

      const items = await tx.findItemsByIdsForUpdate(normalizedItemIds);

      if (items.length !== normalizedItemIds.length) {
        throw notFound('Item da OC nao encontrado');
      }

      for (const item of items) {
        if (Number(item.oc_id) !== Number(ocId)) {
          throw badRequest('Item nao pertence a esta OC');
        }

        ensureItemAvailableForRecount(item);
      }

      await tx.markItemsForRecount({
        ocId,
        itemIds: normalizedItemIds,
        recountStatus: itemStatus.RECOUNT
      });
      await tx.approveItemsExcept({
        ocId,
        itemIds: normalizedItemIds,
        approvedStatus: itemStatus.APPROVED,
        countedStatus: itemStatus.COUNTED
      });
      await tx.updateOcAssignmentAndStatus({
        ocId,
        status: ocStatus.OPEN,
        estoquistaId: normalizedNovoEstoquistaId
      });

      await audit.logAction({
        user, action: 'oc.sent_to_recount', entityType: 'oc', entityId: ocId,
        metadata: {
          previous_status: foundOc.status, empresa_id: empresaId, new_status: ocStatus.OPEN,
          previous_estoquista_id: foundOc.estoquista_id,
          new_estoquista_id: normalizedNovoEstoquistaId, item_ids: normalizedItemIds,
          item_count: normalizedItemIds.length
        },
        auditContext, transactionClient
      });
      return foundOc;
    });

    return { message: 'Itens enviados para recontagem' };
  }

  return { sendOcToRecount };
}

module.exports = { createOcRecountService };
