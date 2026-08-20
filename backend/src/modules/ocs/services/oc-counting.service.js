function createOcCountingService({
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
  itemStatus
}) {
  function assertValidCountQuantity(quantidade) {
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw badRequest('Quantidade deve ser um numero inteiro maior ou igual a zero');
    }
  }

  function assertValidLote(lote) {
    if (!cleanText(lote)) {
      throw badRequest('Lote e obrigatorio');
    }
  }

  function ensureItemAvailableForCount(item) {
    if (!assertItemStatus(item, [itemStatus.PENDING, itemStatus.COUNTED, itemStatus.RECOUNT])) {
      throw badRequest('Item nao esta disponivel para contagem');
    }
  }

  function ensureLocalizacaoAvailableForFirstCount(localizacao) {
    if (!assertItemStatus(localizacao, [itemStatus.PENDING])) {
      throw badRequest('Localizacao nao esta disponivel para primeira contagem');
    }
  }

  function mapNewCountError(err) {
    if (err?.code === '23505' && String(err.constraint || '').includes('idx_contagens_assignment_localizacao_unique')) {
      return conflict('Localizacao ja foi contada neste assignment');
    }

    return err;
  }

  async function saveNewModelCount({ user, empresaId, payload, auditContext }) {
    const { oc_id, oc_localizacao_id, quantidade, lote } = payload;
    const userId = Number(user.id);

    const { context, assignment, count } = await repository.withTransaction(async (tx) => {
      const localizacao = await tx.findLocalizacaoContextById(oc_localizacao_id, { forUpdate: true });

      if (!localizacao) {
        throw notFound('Localizacao da OC nao encontrada');
      }

      if (Number(localizacao.oc_id) !== Number(oc_id)) {
        throw badRequest('Localizacao nao pertence a esta OC');
      }

      const oc = {
        id: localizacao.oc_id,
        gestor_id: localizacao.gestor_id,
        estoquista_id: localizacao.estoquista_id,
        empresa_id: localizacao.empresa_id,
        status: localizacao.oc_status
      };
      assertOcEmpresa(oc, empresaId);
      ensureOcOpen(oc);

      const activeAssignment = await tx.findActiveAssignmentForUser(
        { ocId: localizacao.oc_id, estoquistaId: user.id },
        { forUpdate: true }
      );

      if (!activeAssignment) {
        throw forbidden('Voce nao tem assignment ativo para esta OC');
      }

      await assertEstoquistaEligibleForAssignment(user, empresaId, activeAssignment, tx);

      const assignmentProduto = await tx.findAssignmentProduto({
        assignmentId: activeAssignment.id,
        ocProdutoId: localizacao.oc_produto_id
      });

      if (!assignmentProduto) {
        throw forbidden('Localizacao nao pertence ao assignment ativo');
      }

      const existingCount = await tx.findCountByAssignmentAndLocation({
        assignmentId: activeAssignment.id,
        ocLocalizacaoId: localizacao.id
      });

      if (existingCount) {
        throw conflict('Localizacao ja foi contada neste assignment');
      }

      if (activeAssignment.fase === 'contagem') {
        ensureLocalizacaoAvailableForFirstCount(localizacao);
      }

      let createdCount;
      try {
        createdCount = await tx.createNewModelCount({
          ocId: localizacao.oc_id,
          ocProdutoId: localizacao.oc_produto_id,
          ocLocalizacaoId: localizacao.id,
          assignmentId: activeAssignment.id,
          quantidade,
          lote,
          userId
        });
      } catch (err) {
        throw mapNewCountError(err);
      }

      await tx.updateLocalizacaoStatus({
        ocLocalizacaoId: localizacao.id,
        status: itemStatus.COUNTED
      });
      await tx.updateProdutoStatusFromLocalizacoes({
        ocProdutoId: localizacao.oc_produto_id,
        pendingStatus: itemStatus.PENDING,
        countedStatus: itemStatus.COUNTED
      });

      return {
        context: localizacao,
        assignment: activeAssignment,
        count: createdCount
      };
    });

    return count;
  }

  async function saveOcCount({ user, empresaId, payload, auditContext }) {
    const { oc_id, item_id, oc_localizacao_id, quantidade, lote } = payload;
    assertValidCountQuantity(quantidade);
    assertValidLote(lote);

    const newModelLocationId = oc_localizacao_id || item_id;

    if (newModelLocationId) {
      const locationContext = await repository.findLocalizacaoContextById(newModelLocationId);

      if (locationContext && Number(locationContext.oc_id) === Number(oc_id)) {
        return saveNewModelCount({
          user,
          empresaId,
          payload: {
            oc_id,
            oc_localizacao_id: newModelLocationId,
            quantidade,
            lote: cleanText(lote)
          },
          auditContext
        });
      }
    }

    const userId = Number(user.id);
    const { item, count } = await repository.withTransaction(async (tx) => {
      const oc = await getOcOrFail(oc_id, tx, { forUpdate: true });
      assertOcEmpresa(oc, empresaId);
      assertEstoquistaOwnership(user, oc);
      ensureOcOpen(oc);

      const currentItem = await getOcItemOrFail(
        { ocId: oc_id, itemId: item_id },
        tx,
        { forUpdate: true }
      );
      ensureItemAvailableForCount(currentItem);

      const createdCount = await tx.createCount({
        ocId: oc_id,
        itemId: item_id,
        quantidade,
        lote: cleanText(lote),
        userId
      });

      await tx.updateItemCount({
        ocId: oc_id,
        itemId: item_id,
        quantidade,
        lote: cleanText(lote),
        countedStatus: itemStatus.COUNTED
      });

      return { item: currentItem, count: createdCount };
    });

    return count;
  }

  return { saveOcCount };
}

module.exports = { createOcCountingService };
