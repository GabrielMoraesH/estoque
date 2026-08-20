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

  async function assertEstoquistaAvailableForRecount(estoquistaId, empresaId, repo = repository) {
    const user = await assertEstoquistaAvailableForAssignment(estoquistaId, repo);

    if (Number(user.nivel_estoquista) !== 2) {
      throw badRequest('A recontagem deve ser atribuida a um estoquista nivel 2');
    }

    await assertUserHasEmpresaAccess(estoquistaId, empresaId, repo);

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

  function ensureItemAvailableForCount(item) {
    if (!assertItemStatus(item, [ITEM_STATUS.PENDING, ITEM_STATUS.COUNTED, ITEM_STATUS.RECOUNT])) {
      throw badRequest('Item nao esta disponivel para contagem');
    }
  }

  function ensureLocalizacaoAvailableForFirstCount(localizacao) {
    if (!assertItemStatus(localizacao, [ITEM_STATUS.PENDING])) {
      throw badRequest('Localizacao nao esta disponivel para primeira contagem');
    }
  }

  function ensureItemAvailableForRecount(item) {
    if (!assertItemStatus(item, [ITEM_STATUS.COUNTED, ITEM_STATUS.APPROVED])) {
      throw badRequest('Item nao esta disponivel para recontagem');
    }
  }

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
            status: ASSIGNMENT_STATUS.ACTIVE
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

        await tx.updateOcStatus({ ocId, status: OC_STATUS.OPEN });

        recountContext = { cycle: nextCycle, assignment_id: assignment.id };

        await audit.logAction({
          user, action: 'oc.sent_to_recount', entityType: 'oc', entityId: ocId,
          metadata: {
            previous_status: foundOc.status, empresa_id: empresaId, new_status: OC_STATUS.OPEN,
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
        recountStatus: ITEM_STATUS.RECOUNT
      });
      await tx.approveItemsExcept({
        ocId,
        itemIds: normalizedItemIds,
        approvedStatus: ITEM_STATUS.APPROVED,
        countedStatus: ITEM_STATUS.COUNTED
      });
      await tx.updateOcAssignmentAndStatus({
        ocId,
        status: OC_STATUS.OPEN,
        estoquistaId: normalizedNovoEstoquistaId
      });

      await audit.logAction({
        user, action: 'oc.sent_to_recount', entityType: 'oc', entityId: ocId,
        metadata: {
          previous_status: foundOc.status, empresa_id: empresaId, new_status: OC_STATUS.OPEN,
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

  async function reassignAssignment({ user, empresaId, ocId, assignmentId, novoEstoquistaId, auditContext }) {
    assertAdministrativeApprovalRole(user);
    const normalizedOcId = Number(ocId);
    const normalizedAssignmentId = Number(assignmentId);
    const normalizedNovoEstoquistaId = Number(novoEstoquistaId);

    const result = await repository.withTransaction(async (tx, transactionClient) => {
      const oc = await getOcOrFail(normalizedOcId, tx, { forUpdate: true });
      assertOcEmpresa(oc, empresaId);

      const actor = await getUserOrFail(user.id, tx);
      if (actor.ativo === false || (!isAdmin(actor) && !isGestor(actor))) {
        throw forbidden('Voce nao tem permissao para operar esta OC');
      }
      await assertUserHasEmpresaAccess(actor.id, empresaId, tx);

      const assignment = await tx.findActiveAssignmentByOc(
        { ocId: normalizedOcId },
        { forUpdate: true }
      );
      if (!assignment || Number(assignment.id) !== normalizedAssignmentId) {
        throw notFound('Assignment ativo nao encontrado para esta OC');
      }

      const novoEstoquista = await assertEstoquistaAvailableForAssignment(normalizedNovoEstoquistaId, tx);
      await assertUserHasEmpresaAccess(novoEstoquista.id, empresaId, tx);
      const expectedLevel = assignment.fase === 'recontagem' ? 2 : 1;
      if (Number(novoEstoquista.nivel_estoquista) !== expectedLevel) {
        throw badRequest(
          assignment.fase === 'recontagem'
            ? 'A recontagem deve ser atribuida a um estoquista nivel 2'
            : 'A primeira contagem deve ser atribuida a um estoquista nivel 1'
        );
      }

      const products = await tx.listOperationalProducts({
        ocId: normalizedOcId,
        assignmentId: normalizedAssignmentId
      });
      const progress = products.reduce((summary, product) => ({
        total: summary.total + Number(product.total_localizacoes || 0),
        counted: summary.counted + Number(product.localizacoes_contadas || 0)
      }), { total: 0, counted: 0 });

      if (Number(assignment.estoquista_id) === normalizedNovoEstoquistaId) {
        return { assignment, previousEstoquistaId: normalizedNovoEstoquistaId, progress, changed: false };
      }

      const updated = await tx.reassignActiveAssignment({
        assignmentId: normalizedAssignmentId,
        ocId: normalizedOcId,
        previousEstoquistaId: assignment.estoquista_id,
        novoEstoquistaId: normalizedNovoEstoquistaId
      });
      if (!updated) {
        throw conflict('Assignment foi alterado por outra operacao');
      }

      const result = { assignment: updated, previousEstoquistaId: assignment.estoquista_id, progress, changed: true };
      await audit.logAction({
        user,
        action: 'oc.assignment_reassigned',
        entityType: 'oc',
        entityId: normalizedOcId,
        metadata: {
          empresa_id: Number(empresaId), oc_id: normalizedOcId,
          assignment_id: normalizedAssignmentId, ciclo: Number(updated.ciclo), fase: updated.fase,
          estoquista_anterior_id: Number(assignment.estoquista_id),
          estoquista_novo_id: normalizedNovoEstoquistaId,
          progresso: `${progress.counted}/${progress.total}`
        },
        auditContext,
        transactionClient
      });
      return result;
    });

    return {
      message: result.changed ? 'Responsavel reatribuido com sucesso' : 'Responsavel ja estava atribuido',
      changed: result.changed,
      assignment: result.assignment,
      progresso: result.progress
    };
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
        countedStatus: ITEM_STATUS.COUNTED
      });

      return { item: currentItem, count: createdCount };
    });

    return count;
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
        status: ITEM_STATUS.COUNTED
      });
      await tx.updateProdutoStatusFromLocalizacoes({
        ocProdutoId: localizacao.oc_produto_id,
        pendingStatus: ITEM_STATUS.PENDING,
        countedStatus: ITEM_STATUS.COUNTED
      });

      return {
        context: localizacao,
        assignment: activeAssignment,
        count: createdCount
      };
    });

    return count;
  }

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
            new_status: OC_STATUS.WAITING_APPROVAL,
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
          status: OC_STATUS.WAITING_APPROVAL
        });

        return auditedResult(currentUpdatedOc, currentValidation);
      }

      assertEstoquistaOwnership(user, foundOc);

      const currentValidation = await tx.getFinalizeValidation({
        ocId,
        approvedStatus: ITEM_STATUS.APPROVED,
        countedStatus: ITEM_STATUS.COUNTED
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
        status: OC_STATUS.WAITING_APPROVAL
      });

      return auditedResult(currentUpdatedOc, currentValidation);
    });

    return { message: 'OC enviada para aprovacao', oc: updatedOc };
  }

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
