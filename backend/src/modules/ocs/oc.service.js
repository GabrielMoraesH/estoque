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
      contagens,
      ...safeItem
    } = item;

    return safeItem;
  }

  function toEstoquistaProductDto(product) {
    const {
      saldo_sistema_snapshot,
      saldo_sistema,
      diferenca,
      ...safeProduct
    } = product;

    return safeProduct;
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
      const year = Number(isoDate[1]);
      const month = Number(isoDate[2]);
      const day = Number(isoDate[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return text;
      }
    }

    const monthYear = text.match(/^(\d{2})\/(\d{4})$/);
    if (monthYear) {
      const month = Number(monthYear[1]);
      if (month >= 1 && month <= 12) {
        return `${monthYear[2]}-${monthYear[1]}-01`;
      }
    }

    throw badRequest('Validade invalida. Use MM/AAAA ou AAAA-MM-DD');
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

    if (String(err.constraint || '').includes('oc_assignment')) {
      return conflict('Produto duplicado no assignment da OC');
    }

    return conflict('Registro duplicado na criacao da OC');
  }

  async function createOcWithItems({ user, empresaId, payload, auditContext }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para gerar OC');
    }

    const { estoquista_id, items } = payload;

    if (!estoquista_id) {
      throw badRequest('Selecione um estoquista');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest('Selecione ao menos um produto para gerar a OC');
    }

    const groupedProducts = groupItemsByProduct(items);

    const oc = await repository.withTransaction(async (tx) => {
      await assertUserHasEmpresaAccess(user.id, empresaId, tx);
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
        const createdProductIds = [];

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
          createdProductIds.push(createdProduct.id);

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

        const assignment = await tx.createOcAssignment({
          ocId: createdOc.id,
          ciclo: 1,
          fase: 'contagem',
          estoquistaId: estoquista_id,
          status: ASSIGNMENT_STATUS.ACTIVE
        });

        await tx.createOcAssignmentProdutos({
          assignmentId: assignment.id,
          ocId: createdOc.id,
          ocProdutoIds: createdProductIds
        });
      } catch (err) {
        throw mapCreateModelError(err);
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

  function isRecountDashboardRow(row) {
    return (row?.active_assignment_status === ASSIGNMENT_STATUS.ACTIVE
      && row?.active_assignment_fase === 'recontagem')
      || row?.has_legacy_recount === true
      || ['recontar', 'recontagem'].includes(row?.status);
  }

  function getOperationalDashboardStatus(row) {
    const persistedStatus = row?.status || OC_STATUS.OPEN;

    if (persistedStatus === OC_STATUS.FINALIZED) {
      return OC_STATUS.FINALIZED;
    }

    if (isRecountDashboardRow(row)) {
      return 'recontagem';
    }

    if (persistedStatus === OC_STATUS.WAITING_APPROVAL) {
      return OC_STATUS.WAITING_APPROVAL;
    }

    return OC_STATUS.OPEN;
  }

  function toInteger(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  function toAdminDashboardTask(row, actionReason) {
    return {
      id: row.id,
      codigo: row.codigo,
      empresa_id: row.empresa_id,
      empresa_codigo: row.empresa_codigo || null,
      empresa_nome: row.empresa_nome || null,
      status: getOperationalDashboardStatus(row),
      quantidade_produtos: toInteger(row.qtd),
      responsavel_nome: row.responsavel_nome || null,
      ultima_movimentacao_em: row.ultima_movimentacao_em || null,
      action_reason: actionReason,
      action_to: '/aprovacao'
    };
  }

  function toEstoquistaDashboardTask(row) {
    const total = toInteger(row.qtd);
    const counted = toInteger(row.qtd_contados);

    return {
      id: row.id,
      codigo: row.codigo,
      empresa_id: row.empresa_id,
      empresa_codigo: row.empresa_codigo || null,
      empresa_nome: row.empresa_nome || null,
      status: row.status || OC_STATUS.OPEN,
      total_localizacoes: total,
      localizacoes_contadas: counted,
      progresso_percentual: total > 0 ? Math.round((counted / total) * 100) : 0,
      pronta_para_finalizar: total > 0 && counted >= total,
      ultima_movimentacao_em: row.ultima_movimentacao_em || null,
      action_to: `/oc/${row.id}`
    };
  }

  async function getDashboardSummary({ user, empresaId }) {
    if (isAdmin(user) || isGestor(user)) {
      const rows = await repository.listAdminDashboardRows({ empresaId });
      const classifiedRows = rows.map((row) => ({
        row,
        operationalStatus: getOperationalDashboardStatus(row)
      }));
      const decisionWaitingRows = classifiedRows
        .filter(({ operationalStatus }) => operationalStatus === OC_STATUS.WAITING_APPROVAL)
        .map(({ row }) => row);
      const attention = decisionWaitingRows
        .map((row) => toAdminDashboardTask(row, 'aguardando_aprovacao'));

      return {
        perfil: user.role,
        tipo: 'administrativo',
        status_mapping: {
          total: ['*'],
          em_contagem: [OC_STATUS.OPEN],
          aguardando_aprovacao: [OC_STATUS.WAITING_APPROVAL],
          em_recontagem: ['oc_assignments.status=ativo AND oc_assignments.fase=recontagem', 'oc_items.status=recontar', 'ocs.status IN (recontar, recontagem)'],
          finalizadas: [OC_STATUS.FINALIZED]
        },
        indicadores: {
          total_ocs: rows.length,
          em_contagem: classifiedRows.filter(
            ({ operationalStatus }) => operationalStatus === OC_STATUS.OPEN
          ).length,
          aguardando_aprovacao: decisionWaitingRows.length,
          em_recontagem: classifiedRows.filter(
            ({ operationalStatus }) => operationalStatus === 'recontagem'
          ).length,
          finalizadas: classifiedRows.filter(
            ({ operationalStatus }) => operationalStatus === OC_STATUS.FINALIZED
          ).length,
          atencao_necessaria: decisionWaitingRows.length
        },
        total_filial_ocs: rows.length,
        aguardando_aprovacao_filial: decisionWaitingRows.length,
        atencao_necessaria: attention
      };
    }

    if (!isEstoquista(user)) {
      throw forbidden('Voce nao tem permissao para acessar o dashboard');
    }

    const rows = await repository.listEstoquistaDashboardRows({
      estoquistaId: user.id,
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
    const tasks = rows.map(toEstoquistaDashboardTask);

    return {
      perfil: user.role,
      tipo: 'estoquista',
      indicadores: {
        ocs_atribuidas: tasks.length,
        ocs_em_andamento: tasks.filter(
          (task) => task.localizacoes_contadas > 0 && task.localizacoes_contadas < task.total_localizacoes
        ).length,
        prontas_para_finalizar: tasks.filter((task) => task.pronta_para_finalizar).length
      },
      proximas_ocs: tasks.slice(0, 5)
    };
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

  async function approveOc({ user, empresaId, ocId, auditContext }) {
    assertAdministrativeApprovalRole(user);
    const oc = await repository.withTransaction(async (tx) => {
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
    const oc = await repository.withTransaction(async (tx) => {
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
        item_count: normalizedItemIds.length,
        ...recountContext
      },
      auditContext
    });

    return { message: 'Itens enviados para recontagem' };
  }

  async function listOcItems({ user, empresaId, ocId }) {
    const oc = await getOcOrFail(ocId);
    assertOcEmpresa(oc, empresaId);

    if (await repository.ocHasNewModel(ocId)) {
      if (!isEstoquista(user)) {
        assertOcVisibleToUser(user, oc);
        return repository.listAdminApprovalProducts({ ocId });
      }

      const assignment = await repository.findActiveAssignmentForUser({ ocId, estoquistaId: user.id });

      if (!assignment) {
        throw forbidden('Voce nao tem permissao para acessar esta OC');
      }

      const assignmentId = assignment.id;
      const products = await repository.listOperationalProducts({ ocId, assignmentId });
      const items = [];

      for (const product of products) {
        const locations = await repository.listOperationalLocationsByProduct({
          ocProdutoId: product.id,
          assignmentId
        });

        for (const location of locations) {
          items.push(toEstoquistaProductDto({
            id: location.id,
            oc_id: Number(ocId),
            oc_produto_id: product.id,
            oc_localizacao_id: location.id,
            produto: product.descricao,
            descricao: product.descricao,
            endereco: location.endereco,
            codigo_barras_snapshot: location.codigo_barras_snapshot || null,
            validade_snapshot: location.validade_snapshot || null,
            location: {
              endereco: location.endereco,
              codigo_barras: location.codigo_barras_snapshot || null,
              validade: location.validade_snapshot || null
            },
            status: location.status,
            saldo_contado: location.quantidade ?? null,
            quantidade: location.quantidade ?? null,
            lote: location.lote ?? null,
            total_localizacoes: product.total_localizacoes,
            localizacoes_contadas: product.localizacoes_contadas,
            new_model: true
          }));
        }
      }

      return items;
    }

    assertOcVisibleToUser(user, oc);

    const items = await repository.listItems(ocId);

    if (isEstoquista(user)) {
      return items.map(toEstoquistaItemDto);
    }

    return items;
  }

  async function getOcHistoryDetails({ user, empresaId, ocId }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para acessar este historico');
    }

    const oc = await getOcOrFail(ocId);
    assertOcEmpresa(oc, empresaId);
    const listRows = await repository.listByGestor({ empresaId, ocId });
    const summary = listRows.find((row) => Number(row.id) === Number(ocId));

    if (await repository.ocHasNewModel(ocId)) {
      const [products, assignments] = await Promise.all([
        repository.listAdminApprovalProducts({ ocId }),
        repository.listOcAssignments({ ocId })
      ]);
      return { oc: summary || oc, modelo: 'novo', produtos: products, ciclos: assignments };
    }

    const items = await repository.listItems(ocId);
    return {
      oc: summary || oc,
      modelo: 'legado',
      produtos: items.map((item) => ({
        ...item,
        oc_produto_id: null,
        produto: item.produto,
        descricao: item.produto,
        saldo_sistema_snapshot: item.saldo_sistema,
        saldo_contado_vigente: item.saldo_contado,
        localizacoes: [{
          id: item.id,
          endereco: item.endereco,
          saldo_contado: item.saldo_contado,
          lote: item.lote,
          contagens: item.contagens || []
        }],
        new_model: false
      })),
      ciclos: []
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
    const { oc, updatedOc, validation } = await repository.withTransaction(async (tx) => {
      const foundOc = await getOcOrFail(ocId, tx, { forUpdate: true });
      assertOcEmpresa(foundOc, empresaId);
      ensureOcOpen(foundOc);

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

        return {
          oc: foundOc,
          updatedOc: currentUpdatedOc,
          validation: currentValidation
        };
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
    getDashboardSummary,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor,
    approveOc,
    sendOcToRecount,
    listOcItems,
    getOcHistoryDetails,
    saveOcCount,
    finalizeOc,
    getOcOrFail
  };
}

module.exports = {
  createOcService
};
