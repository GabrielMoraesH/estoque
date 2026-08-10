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

const noopAudit = {
  async logAction() {}
};

const ASSIGNMENT_STATUS = {
  ACTIVE: 'ativo'
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

function createOcService({ repository, audit = noopAudit } = {}) {
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

  function toEstoquistaItemDto(item) {
    const {
      saldo_sistema,
      diferenca,
      primeira_contagem_user_id,
      primeira_contagem_usuario_nome,
      primeira_contagem_em,
      ultima_contagem_user_id,
      ultima_contagem_usuario_nome,
      ultima_contagem_em,
      total_contagens,
      ...safeItem
    } = item;

    return safeItem;
  }

  function assertValidCountQuantity(quantidade) {
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw badRequest('Quantidade deve ser um numero inteiro maior ou igual a zero');
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

  function assertGestorOwnership(user, oc) {
    if (isAdmin(user)) {
      return;
    }

    if (!isGestor(user) || Number(oc.gestor_id) !== Number(user.id)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }
  }

  function assertEstoquistaOwnership(user, oc) {
    if (!isEstoquista(user) || Number(oc.estoquista_id) !== Number(user.id)) {
      throw forbidden('Voce nao tem permissao para operar esta OC');
    }
  }

  function assertOcVisibleToUser(user, oc) {
    if (isAdmin(user)) {
      return;
    }

    if (isGestor(user) && Number(oc.gestor_id) === Number(user.id)) {
      return;
    }

    if (isEstoquista(user) && Number(oc.estoquista_id) === Number(user.id)) {
      return;
    }

    throw forbidden('Voce nao tem permissao para acessar esta OC');
  }

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

  async function ensureOcCompleteForApproval(ocId, repo = repository) {
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

  function ensureItemAvailableForCount(item) {
    if (!assertItemStatus(item, [ITEM_STATUS.PENDING, ITEM_STATUS.COUNTED, ITEM_STATUS.RECOUNT])) {
      throw badRequest('Item nao esta disponivel para contagem');
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

  function normalizeNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  function normalizeDateSnapshot(value) {
    const text = cleanText(value);

    if (!text) {
      return null;
    }

    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      return text;
    }

    const monthYear = text.match(/^(\d{2})\/(\d{4})$/);
    if (monthYear) {
      return `${monthYear[2]}-${monthYear[1]}-01`;
    }

    return null;
  }

  function getProductIdentity(item) {
    const produtoExternoId = cleanText(item.produto_externo_id);
    if (produtoExternoId) {
      return { type: 'produto_externo_id', value: produtoExternoId };
    }

    const codigo = cleanText(item.codigo);
    if (codigo) {
      return { type: 'codigo', value: codigo };
    }

    const produto = cleanText(item.produto);
    if (produto) {
      return { type: 'produto_fallback', value: produto.toLowerCase() };
    }

    return null;
  }

  function getLocationIdentity(item) {
    const localizacaoExternaId = cleanText(item.localizacao_externa_id);
    if (localizacaoExternaId) {
      return { type: 'localizacao_externa_id', value: localizacaoExternaId };
    }

    const endereco = cleanText(item.endereco);
    if (endereco) {
      return { type: 'endereco', value: endereco };
    }

    return null;
  }

  function groupItemsByProduct(items) {
    const grouped = new Map();

    for (const item of items) {
      const produto = cleanText(item?.produto);
      const endereco = cleanText(item?.endereco);
      const productIdentity = getProductIdentity(item || {});
      const locationIdentity = getLocationIdentity(item || {});

      if (!produto) {
        throw badRequest('Produto invalido na OC');
      }

      if (!endereco) {
        throw badRequest('Produto sem localizacao nao pode gerar OC nesta fase');
      }

      if (!productIdentity) {
        throw badRequest('Produto sem identidade valida para gerar OC');
      }

      if (!locationIdentity) {
        throw badRequest('Localizacao sem identidade valida para gerar OC');
      }

      const productKey = `${productIdentity.type}:${productIdentity.value}`;
      const locationKey = `${locationIdentity.type}:${locationIdentity.value}`;

      if (!grouped.has(productKey)) {
        grouped.set(productKey, {
          produtoExternoId: productIdentity.type === 'produto_externo_id' ? productIdentity.value : null,
          codigo: cleanText(item.codigo),
          codigoBarras: cleanText(item.codigo_barras),
          descricaoSnapshot: produto,
          saldoSistemaSnapshot: 0,
          locations: [],
          locationKeys: new Set()
        });
      }

      const group = grouped.get(productKey);

      if (group.locationKeys.has(locationKey)) {
        throw conflict('Localizacao duplicada para o mesmo produto na OC');
      }

      group.saldoSistemaSnapshot += normalizeNumber(item.saldo_sistema);
      group.locations.push({
        localizacaoExternaId: locationIdentity.type === 'localizacao_externa_id'
          ? locationIdentity.value
          : null,
        enderecoSnapshot: endereco,
        codigoBarrasSnapshot: cleanText(item.codigo_barras),
        validadeSnapshot: normalizeDateSnapshot(item.validade)
      });
      group.locationKeys.add(locationKey);
    }

    return Array.from(grouped.values()).map(({ locationKeys, ...group }) => group);
  }

  function mapCreateModelError(err) {
    if (err?.code !== '23505') {
      return err;
    }

    if (String(err.constraint || '').includes('oc_produtos')) {
      return conflict('Produto duplicado na OC');
    }

    if (String(err.constraint || '').includes('oc_localizacoes')) {
      return conflict('Localizacao duplicada para o mesmo produto na OC');
    }

    return conflict('Registro duplicado na criacao da OC');
  }

  async function createOcWithItems({ user, empresaId, payload, auditContext }) {
    const { estoquista_id, items } = payload;

    if (!estoquista_id) {
      throw badRequest('Selecione um estoquista');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest('Selecione ao menos um produto para gerar a OC');
    }

    const groupedProducts = groupItemsByProduct(items);

    const oc = await repository.withTransaction(async (tx) => {
      await assertEstoquistaAvailableForFirstCount(estoquista_id, tx);
      await assertUserHasEmpresaAccess(estoquista_id, empresaId, tx);

      const { nextId, codigo } = await tx.getNextIdentity();
      const gestorId = Number(user.id);
      const createdOc = await tx.createOc({
        id: nextId,
        codigo,
        gestorId,
        estoquistaId: estoquista_id,
        empresaId,
        status: OC_STATUS.OPEN
      });

      try {
        for (const product of groupedProducts) {
          const createdProduct = await tx.createOcProduto({
            ocId: createdOc.id,
            produtoExternoId: product.produtoExternoId,
            codigo: product.codigo,
            codigoBarras: product.codigoBarras,
            descricaoSnapshot: product.descricaoSnapshot,
            saldoSistemaSnapshot: product.saldoSistemaSnapshot,
            status: ITEM_STATUS.PENDING
          });

          for (const location of product.locations) {
            await tx.createOcLocalizacao({
              ocProdutoId: createdProduct.id,
              localizacaoExternaId: location.localizacaoExternaId,
              enderecoSnapshot: location.enderecoSnapshot,
              codigoBarrasSnapshot: location.codigoBarrasSnapshot,
              validadeSnapshot: location.validadeSnapshot,
              status: ITEM_STATUS.PENDING
            });
          }
        }

        await tx.createOcAssignment({
          ocId: createdOc.id,
          ciclo: 1,
          fase: 'contagem',
          estoquistaId: estoquista_id,
          status: ASSIGNMENT_STATUS.ACTIVE
        });
      } catch (err) {
        throw mapCreateModelError(err);
      }

      for (const item of items) {
        await tx.createItem({
          ocId: createdOc.id,
          produto: item.produto,
          saldoSistema: item.saldo_sistema,
          endereco: cleanText(item.endereco),
          codigo: cleanText(item.codigo),
          codigoBarras: cleanText(item.codigo_barras),
          validade: normalizeDateSnapshot(item.validade),
          status: ITEM_STATUS.PENDING
        });
      }

      return createdOc;
    });

    await audit.logAction({
      user,
      action: 'oc.created',
      entityType: 'oc',
      entityId: oc.id,
      metadata: {
        codigo: oc.codigo,
        empresa_id: empresaId,
        gestor_id: oc.gestor_id,
        estoquista_id: oc.estoquista_id,
        item_count: groupedProducts.length
      },
      auditContext
    });

    return { ...oc, qtd: groupedProducts.length };
  }

  function listOcsByGestorInternal({ gestorId, empresaId }) {
    return repository.listByGestor({ gestorId, empresaId });
  }

  async function listMyGestorOcs({ user, empresaId }) {
    if (!isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    return listOcsByGestorInternal({ gestorId: user.id, empresaId });
  }

  async function listOcsByGestor({ user, gestorId, empresaId }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    assertSameUserOrAdmin(user, gestorId);
    return listOcsByGestorInternal({ gestorId, empresaId });
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

  function listApprovalForGestorInternal({ gestorId, empresaId }) {
    return repository.listApprovalForGestor({
      gestorId,
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

    return listApprovalForGestorInternal({ gestorId: user.id, empresaId });
  }

  async function listApprovalForGestor({ user, gestorId, empresaId }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar esta listagem');
    }

    assertSameUserOrAdmin(user, gestorId);
    return listApprovalForGestorInternal({ gestorId, empresaId });
  }

  async function approveOc({ user, empresaId, ocId, auditContext }) {
    const oc = await repository.withTransaction(async (tx) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      assertGestorOwnership(user, foundOc);
      ensureOcWaitingApproval(foundOc);
      await ensureOcCompleteForApproval(ocId, tx);

      await tx.approveItems({
        ocId,
        approvedStatus: ITEM_STATUS.APPROVED,
        countedStatus: ITEM_STATUS.COUNTED
      });
      await tx.updateOcStatus({ ocId, status: OC_STATUS.FINALIZED });

      return foundOc;
    });

    await audit.logAction({
      user,
      action: 'oc.approved',
      entityType: 'oc',
      entityId: ocId,
      metadata: {
        previous_status: oc.status,
        empresa_id: empresaId,
        new_status: OC_STATUS.FINALIZED
      },
      auditContext
    });

    return { message: 'OC aprovada com sucesso' };
  }

  async function sendOcToRecount({ user, empresaId, ocId, itemIds, novoEstoquistaId, auditContext }) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw badRequest('Selecione ao menos um item para recontagem');
    }

    if (!novoEstoquistaId) {
      throw badRequest('Selecione o estoquista responsavel pela recontagem');
    }

    const normalizedItemIds = [...new Set(itemIds.map((itemId) => Number(itemId)))];
    const normalizedNovoEstoquistaId = Number(novoEstoquistaId);
    const oc = await repository.withTransaction(async (tx) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      assertGestorOwnership(user, foundOc);
      ensureOcWaitingApproval(foundOc);

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

      return foundOc;
    });

    await audit.logAction({
      user,
      action: 'oc.sent_to_recount',
      entityType: 'oc',
      entityId: ocId,
      metadata: {
        previous_status: oc.status,
        empresa_id: empresaId,
        new_status: OC_STATUS.OPEN,
        previous_estoquista_id: oc.estoquista_id,
        new_estoquista_id: normalizedNovoEstoquistaId,
        item_ids: normalizedItemIds,
        item_count: normalizedItemIds.length
      },
      auditContext
    });

    return { message: 'Itens enviados para recontagem' };
  }

  async function listOcItems({ user, empresaId, ocId }) {
    const oc = await getOcOrFail(ocId);
    assertOcEmpresa(oc, empresaId);
    assertOcVisibleToUser(user, oc);

    const items = await repository.listItems(ocId);

    if (isEstoquista(user)) {
      return items.map(toEstoquistaItemDto);
    }

    return items;
  }

  async function saveOcCount({ user, empresaId, payload, auditContext }) {
    const { oc_id, item_id, quantidade, lote } = payload;
    assertValidCountQuantity(quantidade);

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
        lote,
        userId
      });

      await tx.updateItemCount({
        ocId: oc_id,
        itemId: item_id,
        quantidade,
        lote,
        countedStatus: ITEM_STATUS.COUNTED
      });

      return { item: currentItem, count: createdCount };
    });

    await audit.logAction({
      user,
      action: 'oc.item_counted',
      entityType: 'oc_item',
      entityId: item_id,
      metadata: {
        oc_id,
        empresa_id: empresaId,
        contagem_id: count.id,
        quantidade,
        lote,
        previous_status: item.status,
        new_status: ITEM_STATUS.COUNTED
      },
      auditContext
    });

    return count;
  }

  async function finalizeOc({ user, empresaId, ocId, auditContext }) {
    const { oc, updatedOc, validation } = await repository.withTransaction(async (tx) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      assertEstoquistaOwnership(user, foundOc);
      ensureOcOpen(foundOc);

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

      return {
        oc: foundOc,
        updatedOc: currentUpdatedOc,
        validation: currentValidation
      };
    });

    await audit.logAction({
      user,
      action: 'oc.finalized',
      entityType: 'oc',
      entityId: ocId,
      metadata: {
        previous_status: oc.status,
        empresa_id: empresaId,
        new_status: OC_STATUS.WAITING_APPROVAL,
        active_item_count: Number(validation.qtd_ativos || 0),
        counted_item_count: Number(validation.qtd_contados || 0)
      },
      auditContext
    });

    return { message: 'OC enviada para aprovacao', oc: updatedOc };
  }

  return {
    createOcWithItems,
    listMyGestorOcs,
    listOcsByGestor,
    listMyEstoquistaOcs,
    listOcsByEstoquista,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor,
    approveOc,
    sendOcToRecount,
    listOcItems,
    saveOcCount,
    finalizeOc,
    getOcOrFail
  };
}

module.exports = {
  createOcService
};
