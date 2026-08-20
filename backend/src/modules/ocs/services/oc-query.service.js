const { OC_STATUS, ITEM_STATUS } = require('../ocStatus');

function createOcQueryService({
  repository,
  isAdmin,
  isGestor,
  isEstoquista,
  forbidden,
  assertSameUserOrAdmin,
  assignmentStatus
}) {
  function isRecountDashboardRow(row) {
    return (row?.active_assignment_status === assignmentStatus.ACTIVE
      && row?.active_assignment_fase === 'recontagem')
      || row?.has_legacy_recount === true
      || ['recontar', 'recontagem'].includes(row?.status);
  }

  function getOperationalDashboardStatus(row) {
    const persistedStatus = row?.status || OC_STATUS.OPEN;

    if (persistedStatus === OC_STATUS.FINALIZED) return OC_STATUS.FINALIZED;
    if (isRecountDashboardRow(row)) return 'recontagem';
    if (persistedStatus === OC_STATUS.WAITING_APPROVAL) return OC_STATUS.WAITING_APPROVAL;
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
      const classifiedRows = rows.map((row) => ({ row, operationalStatus: getOperationalDashboardStatus(row) }));
      const decisionWaitingRows = classifiedRows
        .filter(({ operationalStatus }) => operationalStatus === OC_STATUS.WAITING_APPROVAL)
        .map(({ row }) => row);

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
          em_contagem: classifiedRows.filter(({ operationalStatus }) => operationalStatus === OC_STATUS.OPEN).length,
          aguardando_aprovacao: decisionWaitingRows.length,
          em_recontagem: classifiedRows.filter(({ operationalStatus }) => operationalStatus === 'recontagem').length,
          finalizadas: classifiedRows.filter(({ operationalStatus }) => operationalStatus === OC_STATUS.FINALIZED).length,
          atencao_necessaria: decisionWaitingRows.length
        },
        total_filial_ocs: rows.length,
        aguardando_aprovacao_filial: decisionWaitingRows.length,
        atencao_necessaria: decisionWaitingRows.map((row) => toAdminDashboardTask(row, 'aguardando_aprovacao'))
      };
    }

    if (!isEstoquista(user)) throw forbidden('Voce nao tem permissao para acessar o dashboard');

    const rows = await repository.listEstoquistaDashboardRows({
      estoquistaId: user.id,
      empresaId,
      itemStatus: { approved: ITEM_STATUS.APPROVED, counted: ITEM_STATUS.COUNTED },
      ocStatus: { open: OC_STATUS.OPEN, waitingApproval: OC_STATUS.WAITING_APPROVAL, finalized: OC_STATUS.FINALIZED }
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
    getDashboardSummary,
    listApprovalForAdmin,
    listMyApprovalOcs,
    listApprovalForGestor
  };
}

module.exports = { createOcQueryService };
