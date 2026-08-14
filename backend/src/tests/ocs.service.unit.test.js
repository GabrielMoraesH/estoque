const { createOcService } = require('../modules/ocs/oc.service');
const { createInMemoryOcRepository } = require('../modules/ocs/in-memory-oc.repository');
const { OC_STATUS, ITEM_STATUS } = require('../modules/ocs/ocStatus');
const ERROR_CODES = require('../utils/errorCodes');

function createRepositoryMock(overrides = {}) {
  const repository = {
    withTransaction: jest.fn(async (callback) => callback(repository)),
    getNextIdentity: jest.fn(),
    findOcById: jest.fn(),
    findUserById: jest.fn(),
    userHasEmpresaAccess: jest.fn().mockResolvedValue(true),
    createOc: jest.fn(),
    createOcProduto: jest.fn(),
    createOcLocalizacao: jest.fn(),
    createOcAssignment: jest.fn(),
    createOcAssignmentProdutos: jest.fn(),
    createItem: jest.fn(),
    listByGestor: jest.fn(),
    listByEstoquista: jest.fn(),
    listAdminDashboardRows: jest.fn(),
    listEstoquistaDashboardRows: jest.fn(),
    listApprovalForAdmin: jest.fn(),
    listApprovalForGestor: jest.fn(),
    approveItems: jest.fn(),
    updateOcStatus: jest.fn(),
    updateOcAssignmentAndStatus: jest.fn(),
    findItemsByIdsForUpdate: jest.fn(),
    markItemsForRecount: jest.fn(),
    approveItemsExcept: jest.fn(),
    listItems: jest.fn(),
    findItemById: jest.fn(),
    ocHasNewModel: jest.fn().mockResolvedValue(false),
    findActiveAssignmentForUser: jest.fn(),
    listOperationalProducts: jest.fn(),
    listOperationalLocationsByProduct: jest.fn(),
    listAdminApprovalProducts: jest.fn(),
    findLocalizacaoContextById: jest.fn().mockResolvedValue(null),
    findAssignmentProduto: jest.fn(),
    findActiveFirstCountAssignment: jest.fn(),
    findFirstCountAssignment: jest.fn(),
    findActiveAssignmentByOc: jest.fn(),
    findOcProdutosByIdsForUpdate: jest.fn(),
    getNextAssignmentCycle: jest.fn(),
    hasActiveAssignment: jest.fn(),
    findCountByAssignmentAndLocation: jest.fn(),
    findLegacyItemForLocalizacao: jest.fn(),
    createNewModelCount: jest.fn(),
    updateLocalizacaoStatus: jest.fn(),
    updateProdutoStatusFromLocalizacoes: jest.fn(),
    getNewModelFinalizeValidation: jest.fn(),
    getNewModelApprovalValidation: jest.fn(),
    finalizeAssignment: jest.fn(),
    createCount: jest.fn(),
    updateItemCount: jest.fn(),
    getFinalizeValidation: jest.fn()
  };

  return Object.assign(repository, overrides);
}

function createService({ repository = createRepositoryMock(), audit } = {}) {
  const dependencies = {
    repository,
    audit: audit || { logAction: jest.fn().mockResolvedValue(undefined) }
  };

  return {
    service: createOcService(dependencies),
    ...dependencies
  };
}

describe('OcService unitario com repository mockado', () => {
  const gestor = { id: 11, role: 'gestor' };
  const admin = { id: 1, role: 'admin' };
  const estoquista = { id: 22, role: 'estoquista' };

  it('cria OC nova sem oc_items dentro de transacao e registra auditoria', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({
        id: 22,
        role: 'estoquista',
        ativo: true,
        nivel_estoquista: 1
      }),
      getNextIdentity: jest.fn().mockResolvedValue({ nextId: 100, codigo: 'OC-000100' }),
      createOc: jest.fn().mockResolvedValue({
        id: 100,
        codigo: 'OC-000100',
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      createOcProduto: jest.fn()
        .mockResolvedValueOnce({ id: 900 })
        .mockResolvedValueOnce({ id: 901 }),
      createOcLocalizacao: jest.fn().mockResolvedValue({}),
      createOcAssignment: jest.fn().mockResolvedValue({ id: 950 })
    });
    const { service, audit } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 },
          { produto: 'Luva', codigo: 'LUV', endereco: 'B1', saldo_sistema: 30 }
        ]
      },
      auditContext: { requestId: 'req-oc' }
    })).resolves.toEqual(expect.objectContaining({
      id: 100,
      codigo: 'OC-000100',
      qtd: 2
    }));

    expect(repository.withTransaction).toHaveBeenCalledTimes(1);
    expect(repository.createOc).toHaveBeenCalledWith({
      id: 100,
      codigo: 'OC-000100',
      gestorId: 11,
      estoquistaId: 22,
      empresaId: 1,
      status: OC_STATUS.OPEN
    });
    expect(repository.createOcProduto).toHaveBeenCalledTimes(2);
    expect(repository.createOcLocalizacao).toHaveBeenCalledTimes(2);
    expect(repository.createOcAssignment).toHaveBeenCalledWith({
      ocId: 100,
      ciclo: 1,
      fase: 'contagem',
      estoquistaId: 22,
      status: 'ativo'
    });
    expect(repository.createOcAssignmentProdutos).toHaveBeenCalledWith({
      assignmentId: 950,
      ocId: 100,
      ocProdutoIds: [900, 901]
    });
    expect(repository.createItem).not.toHaveBeenCalled();
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.created',
      entityType: 'oc',
      entityId: 100,
      metadata: expect.objectContaining({ empresa_id: 1, item_count: 2 })
    }));
  });

  it('retorna erro de validacao ao criar OC sem itens', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: []
      }
    })).rejects.toMatchObject({
      message: 'Selecione ao menos um produto para gerar a OC',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.withTransaction).not.toHaveBeenCalled();
  });

  it('retorna erro de regra de negocio quando usuario informado nao e estoquista', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'gestor' })
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toMatchObject({
      message: 'O usuario informado nao e um estoquista',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.createOc).not.toHaveBeenCalled();
  });

  it('propaga excecao inesperada da transacao ao criar OC', async () => {
    const transactionError = new Error('transaction failed');
    const repository = createRepositoryMock({
      withTransaction: jest.fn().mockRejectedValue(transactionError)
    });
    const { service, audit } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toBe(transactionError);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('lista OCs da empresa ativa para gestor logado', async () => {
    const result = [{ id: 1, codigo: 'OC-1' }];
    const repository = createRepositoryMock({
      listByGestor: jest.fn().mockResolvedValue(result)
    });
    const { service } = createService({ repository });

    await expect(service.listMyGestorOcs({ user: gestor, empresaId: 1 })).resolves.toEqual(result);
    expect(repository.listByGestor).toHaveBeenCalledWith({ empresaId: 1 });
  });

  it('admin e gestor veem todas as OCs da empresa ativa sem filtrar pelo criador', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 1, nome: 'Admin A', role: 'admin', empresas: [{ id: 1 }, { id: 6 }] },
        { id: 11, nome: 'Gestor B', role: 'gestor', empresas: [{ id: 1 }, { id: 6 }] },
        { id: 12, nome: 'Gestor C', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }, { id: 6 }] }
      ],
      ocs: [
        { id: 101, codigo: 'OC-A', gestor_id: 1, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN },
        { id: 102, codigo: 'OC-B', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL },
        { id: 103, codigo: 'OC-C', gestor_id: 12, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.FINALIZED },
        { id: 601, codigo: 'OC-D', gestor_id: 12, estoquista_id: 22, empresa_id: 6, status: OC_STATUS.OPEN }
      ],
      items: [
        { id: 1001, oc_id: 101, produto: 'Legado A', status: ITEM_STATUS.PENDING },
        { id: 1002, oc_id: 601, produto: 'Outra empresa', status: ITEM_STATUS.PENDING }
      ],
      ocProdutos: [
        { id: 2001, oc_id: 102, descricao_snapshot: 'Produto novo B', status: ITEM_STATUS.PENDING },
        { id: 2002, oc_id: 103, descricao_snapshot: 'Produto novo C', status: ITEM_STATUS.PENDING }
      ],
      ocLocalizacoes: [
        { id: 3001, oc_produto_id: 2001, endereco_snapshot: 'A1', status: ITEM_STATUS.PENDING },
        { id: 3002, oc_produto_id: 2002, endereco_snapshot: 'B1', status: ITEM_STATUS.PENDING }
      ],
      ocAssignments: [
        { id: 4001, oc_id: 102, ciclo: 1, fase: 'contagem', estoquista_id: 22, status: 'ativo' },
        { id: 4002, oc_id: 103, ciclo: 1, fase: 'contagem', estoquista_id: 22, status: 'finalizado' }
      ]
    });
    const { service } = createService({ repository });

    const adminList = await service.listOcsByGestor({
      user: admin,
      gestorId: 1,
      empresaId: 1
    });
    const gestorList = await service.listMyGestorOcs({
      user: { id: 11, role: 'gestor' },
      empresaId: 1
    });
    const empresa6List = await service.listMyGestorOcs({
      user: { id: 11, role: 'gestor' },
      empresaId: 6
    });

    expect(adminList.map((oc) => oc.codigo)).toEqual(['OC-C', 'OC-B', 'OC-A']);
    expect(gestorList.map((oc) => oc.codigo)).toEqual(['OC-C', 'OC-B', 'OC-A']);
    expect(gestorList.find((oc) => oc.codigo === 'OC-A')).toMatchObject({
      qtd: 1,
      criador_nome: 'Admin A',
      estoquista_nome: 'Estoquista'
    });
    expect(gestorList.find((oc) => oc.codigo === 'OC-B')).toMatchObject({
      qtd: 1,
      criador_nome: 'Gestor B',
      estoquista_nome: 'Estoquista'
    });
    expect(gestorList.find((oc) => oc.codigo === 'OC-C')).toMatchObject({
      criador_nome: 'Gestor C',
      estoquista_nome: 'Estoquista'
    });
    expect(empresa6List.map((oc) => oc.codigo)).toEqual(['OC-D']);
  });

  it('gestor lista, aprova e solicita recontagem por filial sem alterar o criador', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 1, nome: 'Admin A', role: 'admin', empresas: [{ id: 1 }] },
        { id: 11, nome: 'Gestor B', role: 'gestor', empresas: [{ id: 1 }, { id: 6 }] },
        { id: 12, nome: 'Gestor C', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Contador', role: 'estoquista', ativo: true, nivel_estoquista: 1, empresas: [{ id: 1 }] },
        { id: 33, nome: 'Recontador', role: 'estoquista', ativo: true, nivel_estoquista: 2, empresas: [{ id: 1 }] }
      ],
      ocs: [
        { id: 101, codigo: 'OC-ADMIN', gestor_id: 1, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL },
        { id: 102, codigo: 'OC-OUTRO-GESTOR', gestor_id: 12, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL },
        { id: 601, codigo: 'OC-OUTRA-EMPRESA', gestor_id: 12, estoquista_id: 22, empresa_id: 6, status: OC_STATUS.WAITING_APPROVAL }
      ],
      items: [
        { id: 1001, oc_id: 101, produto: 'A', status: ITEM_STATUS.COUNTED },
        { id: 1002, oc_id: 102, produto: 'B', status: ITEM_STATUS.COUNTED },
        { id: 6001, oc_id: 601, produto: 'C', status: ITEM_STATUS.COUNTED }
      ]
    });
    const { service } = createService({ repository });

    const approvals = await service.listMyApprovalOcs({ user: gestor, empresaId: 1 });
    expect(approvals.map((oc) => oc.codigo)).toEqual(['OC-OUTRO-GESTOR', 'OC-ADMIN']);
    expect(approvals.find((oc) => oc.id === 101).gestor_nome).toBe('Admin A');
    expect(approvals.find((oc) => oc.id === 102).gestor_nome).toBe('Gestor C');

    await expect(service.approveOc({ user: gestor, empresaId: 1, ocId: 101 }))
      .resolves.toEqual({ message: 'OC aprovada com sucesso' });
    expect(repository.__getState().ocs.find((oc) => oc.id === 101)).toMatchObject({
      gestor_id: 1,
      status: OC_STATUS.FINALIZED
    });

    await expect(service.sendOcToRecount({
      user: gestor,
      empresaId: 1,
      ocId: 102,
      itemIds: [1002],
      novoEstoquistaId: 33
    })).resolves.toEqual({ message: 'Itens enviados para recontagem' });
    expect(repository.__getState().ocs.find((oc) => oc.id === 102)).toMatchObject({
      gestor_id: 12,
      estoquista_id: 33,
      status: OC_STATUS.OPEN
    });

    await expect(service.approveOc({ user: gestor, empresaId: 1, ocId: 601 }))
      .rejects.toMatchObject({ statusCode: 404, errorCode: ERROR_CODES.NOT_FOUND });
    await expect(service.sendOcToRecount({
      user: gestor,
      empresaId: 1,
      ocId: 601,
      itemIds: [6001],
      novoEstoquistaId: 33
    })).rejects.toMatchObject({ statusCode: 404, errorCode: ERROR_CODES.NOT_FOUND });
  });

  it('bloqueia estoquista nas operacoes administrativas de aprovacao e recontagem', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.approveOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    await expect(service.sendOcToRecount({
      user: estoquista,
      empresaId: 1,
      ocId: 55,
      itemIds: [9],
      novoEstoquistaId: 33
    })).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(repository.withTransaction).not.toHaveBeenCalled();
  });

  it('bloqueia listagem de gestor para perfil sem permissao', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.listMyGestorOcs({ user: estoquista, empresaId: 1 })).rejects.toMatchObject({
      message: 'Voce nao tem permissao para acessar esta listagem',
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(repository.listByGestor).not.toHaveBeenCalled();
  });

  it('salva contagem de item com dono correto e OC aberta', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      findItemById: jest.fn().mockResolvedValue({
        id: 9,
        oc_id: 55,
        status: ITEM_STATUS.PENDING
      }),
      createCount: jest.fn().mockResolvedValue({
        id: 300,
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1',
        user_id: 22
      }),
      updateItemCount: jest.fn().mockResolvedValue({})
    });
    const { service, audit } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1'
      }
    })).resolves.toEqual(expect.objectContaining({
      id: 300,
      quantidade: 8
    }));

    expect(repository.createCount).toHaveBeenCalledWith({
      ocId: 55,
      itemId: 9,
      quantidade: 8,
      lote: 'L1',
      userId: 22
    });
    expect(repository.updateItemCount).toHaveBeenCalledWith({
      ocId: 55,
      itemId: 9,
      quantidade: 8,
      lote: 'L1',
      countedStatus: ITEM_STATUS.COUNTED
    });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.item_counted',
      entityType: 'oc_item',
      entityId: 9
    }));
  });

  it('bloqueia contagem quando estoquista nao e dono da OC', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 99,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      message: 'Voce nao tem permissao para operar esta OC',
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(repository.createCount).not.toHaveBeenCalled();
  });

  it('impede contagem em OC finalizada', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.FINALIZED
      })
    });
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      message: 'OC ja foi finalizada',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.findItemById).not.toHaveBeenCalled();
  });

  it('valida que item contado pertence a OC informada', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      findItemById: jest.fn().mockResolvedValue({
        id: 9,
        oc_id: 999,
        status: ITEM_STATUS.PENDING
      })
    });
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      message: 'Item nao pertence a esta OC',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.createCount).not.toHaveBeenCalled();
  });

  it('finaliza OC quando todos os itens ativos foram contados', async () => {
    const updatedOc = { id: 55, status: OC_STATUS.WAITING_APPROVAL };
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      getFinalizeValidation: jest.fn().mockResolvedValue({
        oc_existe: true,
        qtd_ativos: 2,
        qtd_contados: 2
      }),
      updateOcStatus: jest.fn().mockResolvedValue(updatedOc)
    });
    const { service, audit } = createService({ repository });

    await expect(service.finalizeOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).resolves.toEqual({
      message: 'OC enviada para aprovacao',
      oc: updatedOc
    });
    expect(repository.updateOcStatus).toHaveBeenCalledWith({
      ocId: 55,
      status: OC_STATUS.WAITING_APPROVAL
    });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.finalized',
      entityId: 55
    }));
  });

  it('impede finalizar OC com itens pendentes de contagem', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      getFinalizeValidation: jest.fn().mockResolvedValue({
        oc_existe: true,
        qtd_ativos: 3,
        qtd_contados: 2
      })
    });
    const { service } = createService({ repository });

    await expect(service.finalizeOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      message: 'Conclua a contagem dos itens enviados para recontagem',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.updateOcStatus).not.toHaveBeenCalled();
  });

  it('aprova OC aguardando aprovacao para gestor dono', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      getFinalizeValidation: jest.fn().mockResolvedValue({
        oc_existe: true,
        qtd_ativos: 2,
        qtd_contados: 2
      }),
      approveItems: jest.fn().mockResolvedValue({}),
      updateOcStatus: jest.fn().mockResolvedValue({})
    });
    const { service, audit } = createService({ repository });

    await expect(service.approveOc({
      user: gestor,
      empresaId: 1,
      ocId: 55
    })).resolves.toEqual({ message: 'OC aprovada com sucesso' });
    expect(repository.approveItems).toHaveBeenCalledWith({
      ocId: 55,
      approvedStatus: ITEM_STATUS.APPROVED,
      countedStatus: ITEM_STATUS.COUNTED
    });
    expect(repository.updateOcStatus).toHaveBeenCalledWith({
      ocId: 55,
      status: OC_STATUS.FINALIZED
    });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'oc.approved'
    }));
  });

  it('bloqueia aprovacao quando OC ainda esta aberta', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.approveOc({
      user: gestor,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      message: 'OC nao esta aguardando aprovacao',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.approveItems).not.toHaveBeenCalled();
  });

  it('lista itens da propria OC para estoquista sem saldo esperado ou diferenca', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      listItems: jest.fn().mockResolvedValue([
        {
          id: 9,
          oc_id: 55,
          produto: 'Dipirona',
          endereco: 'A1-01-01',
          codigo: 'DIP',
          codigo_barras: '789',
          saldo_sistema: 25,
          saldo_contado: 10,
          diferenca: -15,
          lote: 'L1',
          status: ITEM_STATUS.COUNTED,
          primeira_contagem_user_id: 22,
          primeira_contagem_usuario_nome: 'Estoquista',
          primeira_contagem_em: '2026-08-10T12:00:00Z',
          ultima_contagem_user_id: 22,
          ultima_contagem_usuario_nome: 'Estoquista',
          ultima_contagem_em: '2026-08-10T12:00:00Z',
          total_contagens: 1
        }
      ])
    });
    const { service } = createService({ repository });

    const result = await service.listOcItems({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 9,
        produto: 'Dipirona',
        endereco: 'A1-01-01',
        saldo_contado: 10,
        lote: 'L1'
      })
    ]);
    expect(result[0]).not.toHaveProperty('saldo_sistema');
    expect(result[0]).not.toHaveProperty('diferenca');
    expect(result[0]).not.toHaveProperty('primeira_contagem_user_id');
    expect(result[0]).not.toHaveProperty('ultima_contagem_user_id');
    expect(Object.keys(result[0]).filter((key) => key.includes('saldo'))).toEqual(['saldo_contado']);
  });

  it('preserva dados administrativos dos itens para gestor dono', async () => {
    const items = [
      {
        id: 9,
        oc_id: 55,
        produto: 'Dipirona',
        saldo_sistema: 25,
        saldo_contado: 10,
        diferenca: -15,
        primeira_contagem_user_id: 22,
        total_contagens: 1
      }
    ];
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      listItems: jest.fn().mockResolvedValue(items)
    });
    const { service } = createService({ repository });

    await expect(service.listOcItems({
      user: gestor,
      empresaId: 1,
      ocId: 55
    })).resolves.toEqual(items);
  });

  it('permite ao gestor abrir detalhes de OC criada por outro gestor na mesma empresa', async () => {
    const legacyItems = [
      { id: 9, oc_id: 55, produto: 'Dipirona', saldo_sistema: 25, status: ITEM_STATUS.COUNTED }
    ];
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 12,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      listItems: jest.fn().mockResolvedValue(legacyItems)
    });
    const { service } = createService({ repository });

    await expect(service.listOcItems({
      user: { id: 11, role: 'gestor' },
      empresaId: 1,
      ocId: 55
    })).resolves.toEqual(legacyItems);
  });

  it('permite ao gestor abrir detalhes de OC nova criada por outro gestor na mesma empresa', async () => {
    const products = [
      { id: 900, oc_id: 55, produto: 'Seringa', new_model: true }
    ];
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 12,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      ocHasNewModel: jest.fn().mockResolvedValue(true),
      listAdminApprovalProducts: jest.fn().mockResolvedValue(products)
    });
    const { service } = createService({ repository });

    await expect(service.listOcItems({
      user: { id: 11, role: 'gestor' },
      empresaId: 1,
      ocId: 55
    })).resolves.toEqual(products);
    expect(repository.listItems).not.toHaveBeenCalled();
  });

  it('bloqueia estoquista ao acessar itens da OC de outro estoquista', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 99,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.listOcItems({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(repository.listItems).not.toHaveBeenCalled();
  });

  it('bloqueia estoquista ao finalizar OC de outro estoquista', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 99,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.finalizeOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(repository.updateOcStatus).not.toHaveBeenCalled();
  });

  it('bloqueia leitura quando x-empresa-id nao corresponde a empresa da OC', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 2,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.listOcItems({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.listItems).not.toHaveBeenCalled();
  });

  it('bloqueia contagem quando OC pertence a outra empresa', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 2,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade: 8,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.createCount).not.toHaveBeenCalled();
  });

  it('bloqueia finalizacao quando OC pertence a outra empresa', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 2,
        status: OC_STATUS.OPEN
      })
    });
    const { service } = createService({ repository });

    await expect(service.finalizeOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.updateOcStatus).not.toHaveBeenCalled();
  });

  it('bloqueia aprovacao administrativa quando OC pertence a outra empresa', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 2,
        status: OC_STATUS.WAITING_APPROVAL
      })
    });
    const { service } = createService({ repository });

    await expect(service.approveOc({
      user: gestor,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.approveItems).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['inteiro positivo', 25]
  ])('aceita quantidade %s', async (description, quantidade) => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      findItemById: jest.fn().mockResolvedValue({
        id: 9,
        oc_id: 55,
        status: ITEM_STATUS.PENDING
      }),
      createCount: jest.fn().mockResolvedValue({
        id: 300,
        oc_id: 55,
        item_id: 9,
        quantidade,
        lote: 'L1',
        user_id: 22
      }),
      updateItemCount: jest.fn().mockResolvedValue({})
    });
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade,
        lote: 'L1'
      }
    })).resolves.toMatchObject({ quantidade });
  });

  it.each([
    ['negativa', -1],
    ['decimal', 1.5],
    ['texto', 'abc']
  ])('rejeita quantidade %s', async (description, quantidade) => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: 55,
        item_id: 9,
        quantidade,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      message: 'Quantidade deve ser um numero inteiro maior ou igual a zero',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.withTransaction).not.toHaveBeenCalled();
  });

  it('caracteriza comportamento legado: segunda contagem do mesmo item cria novo evento e sobrescreve saldo atual', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      findItemById: jest.fn()
        .mockResolvedValueOnce({
          id: 9,
          oc_id: 55,
          status: ITEM_STATUS.PENDING
        })
        .mockResolvedValueOnce({
          id: 9,
          oc_id: 55,
          status: ITEM_STATUS.COUNTED
        }),
      createCount: jest.fn()
        .mockResolvedValueOnce({ id: 300, quantidade: 8 })
        .mockResolvedValueOnce({ id: 301, quantidade: 9 }),
      updateItemCount: jest.fn().mockResolvedValue({})
    });
    const { service } = createService({ repository });

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: 55, item_id: 9, quantidade: 8, lote: 'L1' }
    });
    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: 55, item_id: 9, quantidade: 9, lote: 'L2' }
    });

    expect(repository.createCount).toHaveBeenCalledTimes(2);
    expect(repository.updateItemCount).toHaveBeenLastCalledWith({
      ocId: 55,
      itemId: 9,
      quantidade: 9,
      lote: 'L2',
      countedStatus: ITEM_STATUS.COUNTED
    });
  });

  it('bloqueia criacao de OC para estoquista inativo', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: false })
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toMatchObject({
      message: 'O estoquista informado esta inativo',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.createOc).not.toHaveBeenCalled();
  });

  it('cria nova OC com 1 produto, 1 localizacao e assignment inicial', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ]
    });
    const { service } = createService({ repository });

    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          {
            produto: 'Dipirona 500mg',
            codigo: '789123',
            codigo_barras: '789123456789',
            endereco: 'A1-01-01',
            saldo_sistema: 60,
            validade: '12/2026'
          }
        ]
      }
    });
    const state = repository.__getState();

    expect(oc.qtd).toBe(1);
    expect(state.ocs).toHaveLength(1);
    expect(state.ocProdutos).toHaveLength(1);
    expect(state.ocLocalizacoes).toHaveLength(1);
    expect(state.ocAssignments).toEqual([
      expect.objectContaining({
        oc_id: oc.id,
        ciclo: 1,
        fase: 'contagem',
        estoquista_id: 22,
        status: 'ativo'
      })
    ]);
    expect(state.items).toHaveLength(0);
    expect(state.ocProdutos[0]).toMatchObject({
      descricao_snapshot: 'Dipirona 500mg',
      codigo: '789123',
      saldo_sistema_snapshot: 60
    });
    expect(state.ocLocalizacoes[0]).toMatchObject({
      endereco_snapshot: 'A1-01-01',
      codigo_barras_snapshot: '789123456789',
      validade_snapshot: '2026-12-01'
    });
  });

  it('agrupa 1 produto com 3 localizacoes como 1 item administrativo', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ]
    });
    const { service } = createService({ repository });

    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Dipirona 500mg', codigo: '789123', endereco: 'A1-01-01', saldo_sistema: 10 },
          { produto: 'Dipirona 500mg', codigo: '789123', endereco: 'A1-02-01', saldo_sistema: 20 },
          { produto: 'Dipirona 500mg', codigo: '789123', endereco: 'A1-03-01', saldo_sistema: 30 }
        ]
      }
    });
    const state = repository.__getState();
    const list = await service.listMyGestorOcs({ user: gestor, empresaId: 1 });

    expect(oc.qtd).toBe(1);
    expect(state.ocProdutos).toHaveLength(1);
    expect(state.ocProdutos[0].saldo_sistema_snapshot).toBe(60);
    expect(state.ocLocalizacoes).toHaveLength(3);
    expect(state.items).toHaveLength(0);
    expect(list[0].qtd).toBe(1);
  });

  it('cria 2 produtos com 4 localizacoes e preserva snapshots', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ]
    });
    const { service } = createService({ repository });
    const produtoA = { produto: 'Produto A', codigo: 'A', endereco: 'A1-01-01', saldo_sistema: 100 };

    await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          produtoA,
          { produto: 'Produto A', codigo: 'A', endereco: 'A1-02-01', saldo_sistema: 25 },
          { produto: 'Produto B', codigo: 'B', endereco: 'B1-01-01', saldo_sistema: 50 },
          { produto: 'Produto B', codigo: 'B', endereco: 'B1-02-01', saldo_sistema: 75 }
        ]
      }
    });
    produtoA.saldo_sistema = 250;
    produtoA.endereco = 'Z9-99-99';
    const state = repository.__getState();

    expect(state.ocProdutos).toHaveLength(2);
    expect(state.ocLocalizacoes).toHaveLength(4);
    expect(state.items).toHaveLength(0);
    expect(state.ocProdutos.find((item) => item.codigo === 'A')).toMatchObject({
      saldo_sistema_snapshot: 125
    });
    expect(state.ocLocalizacoes.map((item) => item.endereco_snapshot)).toContain('A1-01-01');
    expect(state.ocLocalizacoes.map((item) => item.endereco_snapshot)).not.toContain('Z9-99-99');
  });

  it('cria OC com o payload enviado por GerarOC apos normalizar identificadores do mock', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista Nivel 1', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ]
    });
    const { service } = createService({ repository });

    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: '22',
        items: [
          {
            produto_externo_id: '',
            produto: 'Dipirona 500mg',
            saldo_sistema: 60,
            localizacao_externa_id: '1',
            endereco: 'A1-01-02',
            codigo: '789123',
            codigo_barras: '789123456789',
            validade: '12/2026'
          },
          {
            produto_externo_id: '',
            produto: 'Dipirona 500mg',
            saldo_sistema: 60,
            localizacao_externa_id: '2',
            endereco: 'A1-02-01',
            codigo: '789123',
            codigo_barras: '789123456780',
            validade: '12/2026'
          },
          {
            produto_externo_id: '',
            produto: 'Amoxicilina 500mg',
            saldo_sistema: 50,
            localizacao_externa_id: '3',
            endereco: 'B2-03-01',
            codigo: '456789',
            codigo_barras: '456789123456',
            validade: '08/2025'
          }
        ]
      }
    });
    const state = repository.__getState();

    expect(oc.qtd).toBe(2);
    expect(state.ocs).toHaveLength(1);
    expect(state.ocProdutos).toHaveLength(2);
    expect(state.ocLocalizacoes).toHaveLength(3);
    expect(state.ocAssignments).toHaveLength(1);
    expect(state.ocAssignmentProdutos).toHaveLength(2);
    expect(state.items).toHaveLength(0);
    expect(state.ocAssignments[0]).toMatchObject({
      oc_id: oc.id,
      ciclo: 1,
      fase: 'contagem',
      status: 'ativo',
      estoquista_id: 22
    });
    expect(state.ocLocalizacoes.map((item) => item.localizacao_externa_id)).toEqual(['1', '2', '3']);
    expect(state.ocLocalizacoes.map((item) => item.validade_snapshot)).toEqual([
      '2026-12-01',
      '2026-12-01',
      '2025-08-01'
    ]);
  });

  it('faz rollback completo se uma localizacao falhar', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ],
      failOnCreateOcLocalizacao: true
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Produto A', codigo: 'A', endereco: 'A1-01-01', saldo_sistema: 10 },
          { produto: 'Produto A', codigo: 'A', endereco: 'A1-02-01', saldo_sistema: 20 }
        ]
      }
    })).rejects.toThrow('location failed');

    expect(repository.__getState()).toMatchObject({
      ocs: [],
      ocProdutos: [],
      ocLocalizacoes: [],
      ocAssignments: [],
      items: []
    });
  });

  it('rejeita estoquista nivel 2 para primeira contagem', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: true, nivel_estoquista: 2 })
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toMatchObject({
      message: 'A primeira contagem deve ser atribuida a um estoquista nivel 1',
      statusCode: 400
    });
  });

  it('rejeita estoquista nivel 3 para primeira contagem', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: true, nivel_estoquista: 3 })
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toMatchObject({
      message: 'A primeira contagem deve ser atribuida a um estoquista nivel 1',
      statusCode: 400
    });
  });

  it('rejeita estoquista sem vinculo com a empresa ativa', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: true, nivel_estoquista: 1 }),
      userHasEmpresaAccess: jest.fn().mockResolvedValue(false)
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Seringa', codigo: 'SER', endereco: 'A1', saldo_sistema: 12 }]
      }
    })).rejects.toMatchObject({
      message: 'Usuario nao tem acesso a esta empresa',
      statusCode: 403
    });
  });

  it('rejeita localizacao duplicada para o mesmo produto', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: true, nivel_estoquista: 1 })
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Dipirona', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 },
          { produto: 'Dipirona', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 }
        ]
      }
    })).rejects.toMatchObject({
      message: 'Localizacao duplicada para o mesmo produto na OC',
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT
    });
  });

  it('traduz constraint de produto duplicado para erro de dominio', async () => {
    const duplicateError = new Error('duplicate key value violates unique constraint');
    duplicateError.code = '23505';
    duplicateError.constraint = 'idx_oc_produtos_oc_id_codigo_unique';
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista', ativo: true, nivel_estoquista: 1 }),
      getNextIdentity: jest.fn().mockResolvedValue({ nextId: 100, codigo: 'OC-000100' }),
      createOc: jest.fn().mockResolvedValue({ id: 100, gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN }),
      createOcProduto: jest.fn().mockRejectedValue(duplicateError)
    });
    const { service } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Dipirona', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 }]
      }
    })).rejects.toMatchObject({
      message: 'Produto duplicado na OC',
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT
    });
    expect(repository.createItem).not.toHaveBeenCalled();
  });

  it('nao vaza saldo esperado para estoquista em OC criada no novo modelo', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ]
    });
    const { service } = createService({ repository });
    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Dipirona', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 }]
      }
    });

    const items = await service.listOcItems({ user: estoquista, empresaId: 1, ocId: oc.id });

    expect(items[0]).not.toHaveProperty('saldo_sistema');
    expect(items[0]).not.toHaveProperty('diferenca');
  });

  it('bloqueia envio para recontagem com novo estoquista inativo', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      findUserById: jest.fn().mockResolvedValue({ id: 33, role: 'estoquista', ativo: false })
    });
    const { service } = createService({ repository });

    await expect(service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: 55,
      itemIds: [9],
      novoEstoquistaId: 33
    })).rejects.toMatchObject({
      message: 'O estoquista informado esta inativo',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.findItemsByIdsForUpdate).not.toHaveBeenCalled();
  });

  it('bloqueia aprovacao quando OC aguardando aprovacao ainda possui item pendente', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      getFinalizeValidation: jest.fn().mockResolvedValue({
        oc_existe: true,
        qtd_ativos: 2,
        qtd_contados: 1
      })
    });
    const { service } = createService({ repository });

    await expect(service.approveOc({
      user: gestor,
      empresaId: 1,
      ocId: 55
    })).rejects.toMatchObject({
      message: 'OC possui itens pendentes de contagem',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.approveItems).not.toHaveBeenCalled();
    expect(repository.updateOcStatus).not.toHaveBeenCalled();
  });

  it('envia itens unicos para recontagem e aprova os demais', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      findUserById: jest.fn().mockResolvedValue({ id: 33, role: 'estoquista' }),
      findItemsByIdsForUpdate: jest.fn().mockResolvedValue([
        { id: 9, oc_id: 55, status: ITEM_STATUS.COUNTED },
        { id: 10, oc_id: 55, status: ITEM_STATUS.APPROVED }
      ]),
      markItemsForRecount: jest.fn().mockResolvedValue({}),
      approveItemsExcept: jest.fn().mockResolvedValue({}),
      updateOcAssignmentAndStatus: jest.fn().mockResolvedValue({})
    });
    const { service } = createService({ repository });

    await expect(service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: 55,
      itemIds: [9, '10', 9],
      novoEstoquistaId: 33
    })).resolves.toEqual({ message: 'Itens enviados para recontagem' });
    expect(repository.findUserById).toHaveBeenCalledWith(33);
    expect(repository.findItemsByIdsForUpdate).toHaveBeenCalledWith([9, 10]);
    expect(repository.markItemsForRecount).toHaveBeenCalledWith({
      ocId: 55,
      itemIds: [9, 10],
      recountStatus: ITEM_STATUS.RECOUNT
    });
    expect(repository.approveItemsExcept).toHaveBeenCalledWith({
      ocId: 55,
      itemIds: [9, 10],
      approvedStatus: ITEM_STATUS.APPROVED,
      countedStatus: ITEM_STATUS.COUNTED
    });
    expect(repository.updateOcAssignmentAndStatus).toHaveBeenCalledWith({
      ocId: 55,
      status: OC_STATUS.OPEN,
      estoquistaId: 33
    });
  });

  it('retorna not found quando item de recontagem nao existe', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      findUserById: jest.fn().mockResolvedValue({ id: 33, role: 'estoquista' }),
      findItemsByIdsForUpdate: jest.fn().mockResolvedValue([
        { id: 9, oc_id: 55, status: ITEM_STATUS.COUNTED }
      ])
    });
    const { service } = createService({ repository });

    await expect(service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: 55,
      itemIds: [9, 10],
      novoEstoquistaId: 33
    })).rejects.toMatchObject({
      message: 'Item da OC nao encontrado',
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.markItemsForRecount).not.toHaveBeenCalled();
  });

  it('impede recontagem com o mesmo estoquista da OC', async () => {
    const repository = createRepositoryMock({
      findOcById: jest.fn().mockResolvedValue({
        id: 55,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.WAITING_APPROVAL
      }),
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista' })
    });
    const { service } = createService({ repository });

    await expect(service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: 55,
      itemIds: [9],
      novoEstoquistaId: 22
    })).rejects.toMatchObject({
      message: 'Selecione um estoquista diferente do responsavel pela primeira contagem',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.findItemsByIdsForUpdate).not.toHaveBeenCalled();
  });

  it('propaga excecao inesperada ao finalizar OC', async () => {
    const unexpectedError = new Error('database timeout');
    const repository = createRepositoryMock({
      withTransaction: jest.fn().mockRejectedValue(unexpectedError)
    });
    const { service, audit } = createService({ repository });

    await expect(service.finalizeOc({
      user: estoquista,
      empresaId: 1,
      ocId: 55
    })).rejects.toBe(unexpectedError);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  async function createNewModelOcForCount({ estoquistaId = 22, userOverrides = {}, items } = {}) {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        {
          id: estoquistaId,
          nome: 'Estoquista',
          role: 'estoquista',
          nivel_estoquista: 1,
          ativo: true,
          empresas: [{ id: 1 }],
          ...userOverrides
        }
      ]
    });
    const { service } = createService({ repository });
    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: estoquistaId,
        items: items || [
          { produto: 'Dipirona 500mg', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 },
          { produto: 'Dipirona 500mg', codigo: 'DIP', endereco: 'A1-01-02', saldo_sistema: 20 }
        ]
      }
    });

    return { repository, service, oc };
  }

  it('conta localizacao no novo modelo com item_id nulo e sem dual-write legado', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const locationId = repository.__getState().ocLocalizacoes[0].id;

    const count = await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: oc.id,
        oc_localizacao_id: locationId,
        quantidade: 0,
        lote: 'L1'
      }
    });
    const state = repository.__getState();

    expect(count).toMatchObject({
      oc_id: oc.id,
      oc_produto_id: state.ocProdutos[0].id,
      oc_localizacao_id: locationId,
      assignment_id: state.ocAssignments[0].id,
      item_id: null,
      user_id: 22,
      quantidade: 0,
      lote: 'L1'
    });
    expect(state.counts).toHaveLength(1);
    expect(state.ocLocalizacoes[0].status).toBe(ITEM_STATUS.COUNTED);
    expect(state.ocProdutos[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.items).toHaveLength(0);
  });

  it('usa assignment ativo como autoridade de Minhas OCs em OC nova mesmo com estoquista_id legado divergente', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 22, nome: 'Assignment', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] },
        { id: 33, nome: 'Legado', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ],
      ocs: [{ id: 70, gestor_id: 11, estoquista_id: 33, empresa_id: 1, status: OC_STATUS.OPEN }],
      items: [{
        id: 900,
        oc_id: 70,
        produto: 'Dipirona',
        codigo: 'DIP',
        endereco: 'A1',
        saldo_sistema: 10,
        status: ITEM_STATUS.PENDING
      }],
      ocProdutos: [{ id: 80, oc_id: 70, codigo: 'DIP', descricao_snapshot: 'Dipirona', status: ITEM_STATUS.PENDING }],
      ocLocalizacoes: [{ id: 90, oc_produto_id: 80, endereco_snapshot: 'A1', status: ITEM_STATUS.PENDING }],
      ocAssignments: [{ id: 100, oc_id: 70, ciclo: 1, fase: 'contagem', estoquista_id: 22, status: 'ativo' }],
      ocAssignmentProdutos: [{ assignment_id: 100, oc_id: 70, oc_produto_id: 80 }]
    });
    const { service } = createService({ repository });

    await expect(service.listMyEstoquistaOcs({
      user: { id: 22, role: 'estoquista' },
      empresaId: 1
    })).resolves.toEqual([expect.objectContaining({ id: 70, qtd: 1, qtd_contados: 0 })]);

    await expect(service.listMyEstoquistaOcs({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1
    })).resolves.toEqual([]);
  });

  it('prioriza trabalho pendente antes da movimentacao recente em Minhas OCs in-memory', async () => {
    const repository = createInMemoryOcRepository({
      ocs: [
        { id: 70, gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN, updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 71, gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN, updated_at: '2026-02-01T00:00:00.000Z' }
      ],
      items: [
        { id: 700, oc_id: 70, status: ITEM_STATUS.PENDING },
        { id: 710, oc_id: 71, status: ITEM_STATUS.COUNTED }
      ]
    });

    const { service } = createService({ repository });
    const rows = await service.listMyEstoquistaOcs({
      user: { id: 22, role: 'estoquista' },
      empresaId: 1
    });

    expect(rows.map((row) => row.id)).toEqual([70, 71]);
  });

  it('consolida produto como contado somente quando todas as localizacoes forem contadas', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const [first, second] = repository.__getState().ocLocalizacoes;

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: first.id, quantidade: 1, lote: 'L1' }
    });
    expect(repository.__getState().ocProdutos[0].status).toBe(ITEM_STATUS.PENDING);

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: second.id, quantidade: 2, lote: 'L2' }
    });
    expect(repository.__getState().ocProdutos[0].status).toBe(ITEM_STATUS.COUNTED);
  });

  it('faz rollback da contagem nova se falhar ao atualizar localizacao', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ],
      failOnUpdateLocalizacaoStatus: true
    });
    const { service } = createService({ repository });
    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [{ produto: 'Dipirona', codigo: 'DIP', endereco: 'A1-01-01', saldo_sistema: 10 }]
      }
    });
    const locationId = repository.__getState().ocLocalizacoes[0].id;

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: locationId, quantidade: 1, lote: 'L1' }
    })).rejects.toThrow('location status update failed');

    const state = repository.__getState();
    expect(state.counts).toHaveLength(0);
    expect(state.ocLocalizacoes[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.ocProdutos[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.items).toHaveLength(0);
  });

  it('rejeita duplicidade e double-submit sem criar segundo evento', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const locationId = repository.__getState().ocLocalizacoes[0].id;
    const payload = { oc_id: oc.id, oc_localizacao_id: locationId, quantidade: 1, lote: 'L1' };

    await service.saveOcCount({ user: estoquista, empresaId: 1, payload });
    await expect(service.saveOcCount({ user: estoquista, empresaId: 1, payload })).rejects.toMatchObject({
      message: 'Localizacao ja foi contada neste assignment',
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT
    });
    expect(repository.__getState().counts).toHaveLength(1);
  });

  it('bloqueia novo fluxo para estoquista diferente, nivel 2, empresa errada e lote vazio', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const locationId = repository.__getState().ocLocalizacoes[0].id;
    const basePayload = { oc_id: oc.id, oc_localizacao_id: locationId, quantidade: 1, lote: 'L1' };

    await expect(service.saveOcCount({
      user: { id: 99, role: 'estoquista' },
      empresaId: 1,
      payload: basePayload
    })).rejects.toMatchObject({ statusCode: 403 });

    const level2Repository = createInMemoryOcRepository({
      users: [
        { id: 33, nome: 'Nivel 2', role: 'estoquista', nivel_estoquista: 2, ativo: true, empresas: [{ id: 1 }] }
      ],
      ocs: [{ id: 70, gestor_id: 11, estoquista_id: 33, empresa_id: 1, status: OC_STATUS.OPEN }],
      ocProdutos: [{
        id: 80,
        oc_id: 70,
        codigo: 'DIP',
        descricao_snapshot: 'Dipirona',
        status: ITEM_STATUS.PENDING
      }],
      ocLocalizacoes: [{
        id: 90,
        oc_produto_id: 80,
        endereco_snapshot: 'A1',
        status: ITEM_STATUS.PENDING
      }],
      ocAssignments: [{
        id: 100,
        oc_id: 70,
        ciclo: 1,
        fase: 'contagem',
        estoquista_id: 33,
        status: 'ativo'
      }]
    });
    const { service: level2Service } = createService({ repository: level2Repository });
    await expect(level2Service.saveOcCount({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      payload: {
        oc_id: 70,
        oc_localizacao_id: 90,
        quantidade: 1,
        lote: 'L1'
      }
    })).rejects.toMatchObject({ statusCode: 403 });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 2,
      payload: basePayload
    })).rejects.toMatchObject({ statusCode: 404 });

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { ...basePayload, lote: '   ' }
    })).rejects.toMatchObject({
      message: 'Lote e obrigatorio',
      statusCode: 400
    });
  });

  it.each([
    ['negativa', -1],
    ['decimal', 1.5]
  ])('rejeita quantidade %s no novo fluxo', async (description, quantidade) => {
    const { repository, service, oc } = await createNewModelOcForCount();

    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: {
        oc_id: oc.id,
        oc_localizacao_id: repository.__getState().ocLocalizacoes[0].id,
        quantidade,
        lote: 'L1'
      }
    })).rejects.toMatchObject({
      message: 'Quantidade deve ser um numero inteiro maior ou igual a zero',
      statusCode: 400
    });
  });

  it('lista operacao nova sem saldo e preserva snapshot/retomada', async () => {
    const { repository, service, oc } = await createNewModelOcForCount({
      items: [
        {
          produto: 'Dipirona 500mg',
          codigo: 'DIP',
          endereco: 'A1-01-01',
          codigo_barras: '789123456789',
          validade: '2026-12-01',
          saldo_sistema: 10
        }
      ]
    });
    const locationId = repository.__getState().ocLocalizacoes[0].id;

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: locationId, quantidade: 7, lote: 'RET' }
    });
    const items = await service.listOcItems({ user: estoquista, empresaId: 1, ocId: oc.id });
    const counted = items.find((item) => Number(item.oc_localizacao_id) === Number(locationId));

    expect(counted).toMatchObject({
      endereco: 'A1-01-01',
      codigo_barras_snapshot: '789123456789',
      validade_snapshot: '2026-12-01',
      status: ITEM_STATUS.COUNTED,
      quantidade: 7,
      lote: 'RET',
      new_model: true
    });
    expect(JSON.stringify(items)).not.toContain('saldo_sistema');
    expect(JSON.stringify(items)).not.toContain('diferenca');
    expect(JSON.stringify(items)).not.toContain('saldo_sistema_snapshot');
  });

  it('finaliza OC nova somente depois de todas as localizacoes contadas e finaliza assignment', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const [first, second] = repository.__getState().ocLocalizacoes;

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: first.id, quantidade: 1, lote: 'L1' }
    });
    await expect(service.finalizeOc({ user: estoquista, empresaId: 1, ocId: oc.id })).rejects.toMatchObject({
      message: 'Conclua a contagem das localizacoes pendentes',
      statusCode: 400
    });

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: second.id, quantidade: 2, lote: 'L2' }
    });
    await expect(service.finalizeOc({ user: estoquista, empresaId: 1, ocId: oc.id })).resolves.toMatchObject({
      message: 'OC enviada para aprovacao',
      oc: expect.objectContaining({ status: OC_STATUS.WAITING_APPROVAL })
    });

    const state = repository.__getState();
    expect(state.ocAssignments[0]).toMatchObject({ status: 'finalizado' });
    expect(state.ocAssignments[0].finalizado_em).toBeTruthy();
    expect(state.ocs[0].status).toBe(OC_STATUS.WAITING_APPROVAL);
  });

  it('bloqueia nova contagem e nova finalizacao depois que o assignment foi finalizado', async () => {
    const { repository, service, oc } = await createNewModelOcForCount();
    const [first, second] = repository.__getState().ocLocalizacoes;

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: first.id, quantidade: 1, lote: 'L1' }
    });
    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: second.id, quantidade: 2, lote: 'L2' }
    });
    await service.finalizeOc({ user: estoquista, empresaId: 1, ocId: oc.id });

    await expect(service.finalizeOc({ user: estoquista, empresaId: 1, ocId: oc.id })).rejects.toMatchObject({
      message: 'OC nao esta aberta',
      statusCode: 400
    });
    await expect(service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: second.id, quantidade: 3, lote: 'L3' }
    })).rejects.toMatchObject({
      message: 'OC nao esta aberta',
      statusCode: 400
    });
    expect(repository.__getState().counts).toHaveLength(2);
  });

  async function createNewModelOcForRecount() {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 1, nome: 'Admin', role: 'admin', ativo: true, empresas: [{ id: 1 }] },
        { id: 11, nome: 'Gestor', role: 'gestor', ativo: true, empresas: [{ id: 1 }] },
        { id: 22, nome: 'Contador', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] },
        { id: 33, nome: 'Recontador', role: 'estoquista', nivel_estoquista: 2, ativo: true, empresas: [{ id: 1 }] },
        { id: 44, nome: 'Nivel 3', role: 'estoquista', nivel_estoquista: 3, ativo: true, empresas: [{ id: 1 }] },
        { id: 55, nome: 'Inativo', role: 'estoquista', nivel_estoquista: 2, ativo: false, empresas: [{ id: 1 }] },
        { id: 66, nome: 'Outra empresa', role: 'estoquista', nivel_estoquista: 2, ativo: true, empresas: [{ id: 2 }] }
      ]
    });
    const { service } = createService({ repository });
    const oc = await service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Produto A', codigo: 'A', endereco: 'A1', saldo_sistema: 10 },
          { produto: 'Produto B', codigo: 'B', endereco: 'B1', saldo_sistema: 40 },
          { produto: 'Produto B', codigo: 'B', endereco: 'B2', saldo_sistema: 60 },
          { produto: 'Produto C', codigo: 'C', endereco: 'C1', saldo_sistema: 30 },
          { produto: 'Produto D', codigo: 'D', endereco: 'D1', saldo_sistema: 20 },
          { produto: 'Produto D', codigo: 'D', endereco: 'D2', saldo_sistema: 20 },
          { produto: 'Produto D', codigo: 'D', endereco: 'D3', saldo_sistema: 20 }
        ]
      }
    });

    for (const location of repository.__getState().ocLocalizacoes) {
      await service.saveOcCount({
        user: estoquista,
        empresaId: 1,
        payload: { oc_id: oc.id, oc_localizacao_id: location.id, quantidade: 10, lote: 'ABC' }
      });
    }

    await service.finalizeOc({ user: estoquista, empresaId: 1, ocId: oc.id });
    return { repository, service, oc };
  }

  it('executa recontagem parcial A/B/C/D para B/D sem vazar produtos ou saldos ao recontador', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const stateAfterFirstCount = repository.__getState();
    const selectedProductIds = stateAfterFirstCount.ocProdutos
      .filter((produto) => ['Produto B', 'Produto D'].includes(produto.descricao_snapshot))
      .map((produto) => produto.id);

    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: selectedProductIds,
      novoEstoquistaId: 33
    });

    const state = repository.__getState();
    const recountAssignment = state.ocAssignments.find((assignment) => assignment.fase === 'recontagem');
    const assignmentProducts = state.ocAssignmentProdutos
      .filter((item) => Number(item.assignment_id) === Number(recountAssignment.id))
      .map((item) => item.oc_produto_id);
    expect(recountAssignment).toMatchObject({ ciclo: 2, estoquista_id: 33, status: 'ativo' });
    expect(assignmentProducts.sort()).toEqual([...selectedProductIds].sort());

    const myOcs = await service.listMyEstoquistaOcs({ user: { id: 33, role: 'estoquista' }, empresaId: 1 });
    expect(myOcs).toEqual([expect.objectContaining({ id: oc.id, qtd: 5, qtd_contados: 0 })]);

    const items = await service.listOcItems({ user: { id: 33, role: 'estoquista' }, empresaId: 1, ocId: oc.id });
    expect(items).toHaveLength(5);
    expect(new Set(items.map((item) => item.produto))).toEqual(new Set(['Produto B', 'Produto D']));
    expect(JSON.stringify(items)).not.toContain('saldo_sistema');
    expect(JSON.stringify(items)).not.toContain('diferenca');
    expect(JSON.stringify(items)).not.toContain('primeira_contagem');
  });

  it('retoma recontagem parcial e finaliza somente apos todas as localizacoes do assignment', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productIds = repository.__getState().ocProdutos
      .filter((produto) => ['Produto B', 'Produto D'].includes(produto.descricao_snapshot))
      .map((produto) => produto.id);
    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: productIds,
      novoEstoquistaId: 33
    });

    const recountLocations = repository.__getState().ocLocalizacoes.filter((location) =>
      productIds.includes(location.oc_produto_id)
    );
    await service.saveOcCount({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: recountLocations[0].id, quantidade: 95, lote: 'XYZ' }
    });
    await service.saveOcCount({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: recountLocations[1].id, quantidade: 96, lote: 'XYZ' }
    });

    const resumed = await service.listOcItems({ user: { id: 33, role: 'estoquista' }, empresaId: 1, ocId: oc.id });
    expect(resumed.filter((item) => item.status === ITEM_STATUS.COUNTED)).toHaveLength(2);
    expect(resumed.filter((item) => item.status === ITEM_STATUS.PENDING)).toHaveLength(3);
    expect(JSON.stringify(resumed)).not.toContain('ABC');
    await expect(service.finalizeOc({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      ocId: oc.id
    })).rejects.toMatchObject({ message: 'Conclua a contagem das localizacoes pendentes' });

    for (const location of recountLocations.slice(2)) {
      await service.saveOcCount({
        user: { id: 33, role: 'estoquista' },
        empresaId: 1,
        payload: { oc_id: oc.id, oc_localizacao_id: location.id, quantidade: 97, lote: 'XYZ' }
      });
    }

    await expect(service.finalizeOc({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      ocId: oc.id
    })).resolves.toMatchObject({
      message: 'OC enviada para aprovacao',
      oc: expect.objectContaining({ status: OC_STATUS.WAITING_APPROVAL })
    });
  });

  it('preserva historico, bloqueia aprovacao com assignment ativo, aprova apos recontagem e suporta ciclo 3', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productB = repository.__getState().ocProdutos.find((produto) => produto.descricao_snapshot === 'Produto B');
    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    });

    await expect(service.approveOc({ user: admin, empresaId: 1, ocId: oc.id }))
      .rejects.toMatchObject({ message: 'OC nao esta aguardando aprovacao' });

    const bLocations = repository.__getState().ocLocalizacoes
      .filter((location) => Number(location.oc_produto_id) === Number(productB.id));
    for (const location of bLocations) {
      await service.saveOcCount({
        user: { id: 33, role: 'estoquista' },
        empresaId: 1,
        payload: { oc_id: oc.id, oc_localizacao_id: location.id, quantidade: 95, lote: 'XYZ' }
      });
    }
    await service.finalizeOc({ user: { id: 33, role: 'estoquista' }, empresaId: 1, ocId: oc.id });

    const details = await service.listOcItems({ user: admin, empresaId: 1, ocId: oc.id });
    const bDetail = details.find((item) => Number(item.id) === Number(productB.id));
    expect(bDetail.saldo_contado_vigente).toBe(190);
    expect(bDetail.diferenca).toBe(90);
    expect(bDetail.localizacoes[0].contagens).toHaveLength(2);
    expect(bDetail.localizacoes[0].contagens.map((count) => count.lote)).toEqual(['ABC', 'XYZ']);
    expect(bDetail.localizacoes[0].contagens.map((count) => count.assignment_status))
      .toEqual(['finalizado', 'finalizado']);

    await expect(service.approveOc({ user: admin, empresaId: 1, ocId: oc.id }))
      .resolves.toEqual({ message: 'OC aprovada com sucesso' });
    expect(repository.__getState().ocs[0].status).toBe(OC_STATUS.FINALIZED);
  });

  it('nao usa contagem de assignment ativo como resultado administrativo vigente', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productB = repository.__getState().ocProdutos.find((produto) => produto.descricao_snapshot === 'Produto B');

    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    });

    const firstBLocation = repository.__getState().ocLocalizacoes
      .find((location) => Number(location.oc_produto_id) === Number(productB.id));
    await service.saveOcCount({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: firstBLocation.id, quantidade: 95, lote: 'XYZ' }
    });

    const details = await service.listOcItems({ user: admin, empresaId: 1, ocId: oc.id });
    const bDetail = details.find((item) => Number(item.id) === Number(productB.id));

    expect(bDetail.saldo_contado_vigente).toBe(20);
    expect(bDetail.diferenca).toBe(-80);
    expect(bDetail.localizacoes[0].saldo_contado).toBe(10);
    expect(bDetail.localizacoes[0].contagens.map((count) => count.assignment_status))
      .toEqual(['finalizado', 'ativo']);
  });

  it('impede dois assignments ativos para a mesma OC', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productB = repository.__getState().ocProdutos.find((produto) => produto.descricao_snapshot === 'Produto B');
    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    });

    await expect(repository.createOcAssignment({
      ocId: oc.id,
      ciclo: 3,
      fase: 'recontagem',
      estoquistaId: 33,
      status: 'ativo'
    })).rejects.toMatchObject({
      code: '23505',
      constraint: 'idx_oc_assignments_active_unique'
    });
  });

  it('faz rollback da solicitacao de recontagem se falhar ao associar produtos ao assignment', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const stateBefore = repository.__getState();
    const productB = stateBefore.ocProdutos.find((produto) => produto.descricao_snapshot === 'Produto B');
    const failingRepository = createInMemoryOcRepository({
      ...stateBefore,
      failOnCreateOcAssignmentProdutos: true
    });
    const { service: failingService } = createService({ repository: failingRepository });

    await expect(failingService.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    })).rejects.toThrow('assignment products failed');

    const stateAfter = failingRepository.__getState();
    expect(stateAfter.ocs.find((item) => Number(item.id) === Number(oc.id)).status)
      .toBe(OC_STATUS.WAITING_APPROVAL);
    expect(stateAfter.ocAssignments).toHaveLength(stateBefore.ocAssignments.length);
    expect(stateAfter.ocAssignmentProdutos).toHaveLength(stateBefore.ocAssignmentProdutos.length);
  });

  it('cria ciclo 3 ao solicitar nova recontagem depois do ciclo 2 finalizado', async () => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productB = repository.__getState().ocProdutos.find((produto) => produto.descricao_snapshot === 'Produto B');

    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    });

    const bLocations = repository.__getState().ocLocalizacoes
      .filter((location) => Number(location.oc_produto_id) === Number(productB.id));
    for (const location of bLocations) {
      await service.saveOcCount({
        user: { id: 33, role: 'estoquista' },
        empresaId: 1,
        payload: { oc_id: oc.id, oc_localizacao_id: location.id, quantidade: 95, lote: 'XYZ' }
      });
    }
    await service.finalizeOc({ user: { id: 33, role: 'estoquista' }, empresaId: 1, ocId: oc.id });

    await service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productB.id],
      novoEstoquistaId: 33
    });
    expect(repository.__getState().ocAssignments.at(-1)).toMatchObject({ ciclo: 3, fase: 'recontagem' });
  });

  it('dashboard admin resume somente OCs da empresa ativa e identifica recontagem', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 1, nome: 'Admin', role: 'admin' },
        { id: 11, nome: 'Gestor A', role: 'gestor' },
        { id: 22, nome: 'Estoquista A', role: 'estoquista' },
        { id: 33, nome: 'Estoquista B', role: 'estoquista' }
      ],
      ocs: [
        { id: 10, codigo: 'OC-00010', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN },
        { id: 11, codigo: 'OC-00011', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL },
        { id: 12, codigo: 'OC-00012', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN },
        { id: 13, codigo: 'OC-00013', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.FINALIZED },
        { id: 20, codigo: 'OC-00020', gestor_id: 11, estoquista_id: 22, empresa_id: 2, status: OC_STATUS.WAITING_APPROVAL }
      ],
      items: [
        { id: 100, oc_id: 10, status: ITEM_STATUS.PENDING },
        { id: 110, oc_id: 11, status: ITEM_STATUS.COUNTED },
        { id: 130, oc_id: 13, status: ITEM_STATUS.APPROVED },
        { id: 200, oc_id: 20, status: ITEM_STATUS.COUNTED }
      ],
      ocProdutos: [
        { id: 120, oc_id: 12, descricao_snapshot: 'Produto R', status: ITEM_STATUS.COUNTED }
      ],
      ocAssignments: [
        { id: 1, oc_id: 12, ciclo: 2, fase: 'recontagem', estoquista_id: 33, status: 'ativo' }
      ]
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: admin,
      empresaId: 1
    });

    expect(result.indicadores).toEqual({
      total_ocs: 4,
      em_contagem: 1,
      aguardando_aprovacao: 1,
      em_recontagem: 1,
      finalizadas: 1
    });
    expect(result.atencao_necessaria).toHaveLength(1);
    expect(result.atencao_necessaria[0]).toMatchObject({
      id: 11,
      status: OC_STATUS.WAITING_APPROVAL,
      action_to: '/aprovacao'
    });
  });

  it('dashboard gestor inclui todas as OCs aguardando decisao na empresa ativa', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor A', role: 'gestor' },
        { id: 12, nome: 'Gestor B', role: 'gestor' },
        { id: 22, nome: 'Estoquista', role: 'estoquista' }
      ],
      ocs: [
        { id: 10, codigo: 'OC-00010', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL },
        { id: 11, codigo: 'OC-00011', gestor_id: 12, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.WAITING_APPROVAL }
      ],
      items: [
        { id: 100, oc_id: 10, status: ITEM_STATUS.COUNTED },
        { id: 110, oc_id: 11, status: ITEM_STATUS.COUNTED }
      ]
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: gestor,
      empresaId: 1
    });

    expect(result.indicadores.total_ocs).toBe(2);
    expect(result.indicadores.aguardando_aprovacao).toBe(2);
    expect(result.aguardando_aprovacao_filial).toBe(2);
    expect(result.atencao_necessaria.map((item) => item.id)).toEqual([11, 10]);
  });

  it('dashboard estoquista retorna somente tarefas proprias e sem campos sensiveis', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 22, nome: 'Estoquista A', role: 'estoquista', nivel_estoquista: 1 },
        { id: 23, nome: 'Estoquista B', role: 'estoquista', nivel_estoquista: 1 }
      ],
      ocs: [
        { id: 10, codigo: 'OC-00010', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN },
        { id: 11, codigo: 'OC-00011', gestor_id: 11, estoquista_id: 23, empresa_id: 1, status: OC_STATUS.OPEN },
        { id: 20, codigo: 'OC-00020', gestor_id: 11, estoquista_id: 22, empresa_id: 2, status: OC_STATUS.OPEN }
      ],
      items: [
        { id: 100, oc_id: 10, saldo_sistema: 99, diferenca: 1, status: ITEM_STATUS.COUNTED },
        { id: 101, oc_id: 10, saldo_sistema: 50, diferenca: null, status: ITEM_STATUS.PENDING },
        { id: 110, oc_id: 11, status: ITEM_STATUS.PENDING },
        { id: 200, oc_id: 20, status: ITEM_STATUS.PENDING }
      ]
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: estoquista,
      empresaId: 1
    });

    expect(result.indicadores).toEqual({
      ocs_atribuidas: 1,
      ocs_em_andamento: 1,
      prontas_para_finalizar: 0
    });
    expect(result.proximas_ocs).toHaveLength(1);
    expect(result.proximas_ocs[0]).toMatchObject({
      id: 10,
      total_localizacoes: 2,
      localizacoes_contadas: 1,
      action_to: '/oc/10'
    });
    expect(JSON.stringify(result)).not.toContain('saldo_sistema');
    expect(JSON.stringify(result)).not.toContain('diferenca');
  });

  it('dashboard estoquista classifica progresso 0/N, parcial e N/N', async () => {
    const locations = [];
    const counts = [];
    const ocProdutos = [];
    const ocAssignments = [];

    [0, 1, 3, 4].forEach((counted, index) => {
      const ocId = 80 + index;
      const produtoId = 800 + index;
      const assignmentId = 900 + index;

      ocProdutos.push({ id: produtoId, oc_id: ocId, descricao_snapshot: `Produto ${index}`, status: ITEM_STATUS.PENDING });
      ocAssignments.push({ id: assignmentId, oc_id: ocId, ciclo: 1, fase: 'contagem', estoquista_id: 22, status: 'ativo' });

      for (let localIndex = 0; localIndex < 4; localIndex += 1) {
        const locationId = 1000 + index * 10 + localIndex;
        locations.push({ id: locationId, oc_produto_id: produtoId, status: ITEM_STATUS.PENDING });

        if (localIndex < counted) {
          counts.push({
            id: 2000 + index * 10 + localIndex,
            oc_id: ocId,
            oc_produto_id: produtoId,
            oc_localizacao_id: locationId,
            assignment_id: assignmentId,
            user_id: 22
          });
        }
      }
    });

    const repository = createInMemoryOcRepository({
      users: [{ id: 22, nome: 'Estoquista A', role: 'estoquista', nivel_estoquista: 1 }],
      ocs: [0, 1, 2, 3].map((index) => ({
        id: 80 + index,
        codigo: `OC-0008${index}`,
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      })),
      ocProdutos,
      ocLocalizacoes: locations,
      ocAssignments,
      ocAssignmentProdutos: ocAssignments.map((assignment, index) => ({
        assignment_id: assignment.id,
        oc_id: assignment.oc_id,
        oc_produto_id: ocProdutos[index].id
      })),
      counts
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: estoquista,
      empresaId: 1
    });

    expect(result.indicadores).toEqual({
      ocs_atribuidas: 4,
      ocs_em_andamento: 2,
      prontas_para_finalizar: 1
    });
    expect(result.proximas_ocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 80, total_localizacoes: 4, localizacoes_contadas: 0, pronta_para_finalizar: false }),
      expect.objectContaining({ id: 81, total_localizacoes: 4, localizacoes_contadas: 1, pronta_para_finalizar: false }),
      expect.objectContaining({ id: 82, total_localizacoes: 4, localizacoes_contadas: 3, pronta_para_finalizar: false }),
      expect.objectContaining({ id: 83, total_localizacoes: 4, localizacoes_contadas: 4, pronta_para_finalizar: true })
    ]));
  });

  it('dashboard estoquista calcula recontagem parcial somente com produtos do assignment ativo', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 33, nome: 'Recontador', role: 'estoquista', nivel_estoquista: 2 }
      ],
      ocs: [
        { id: 90, codigo: 'OC-00090', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN }
      ],
      ocProdutos: [
        { id: 900, oc_id: 90, descricao_snapshot: 'Produto A', status: ITEM_STATUS.COUNTED },
        { id: 901, oc_id: 90, descricao_snapshot: 'Produto B', status: ITEM_STATUS.COUNTED },
        { id: 902, oc_id: 90, descricao_snapshot: 'Produto C', status: ITEM_STATUS.COUNTED },
        { id: 903, oc_id: 90, descricao_snapshot: 'Produto D', status: ITEM_STATUS.COUNTED }
      ],
      ocLocalizacoes: [
        { id: 910, oc_produto_id: 900, status: ITEM_STATUS.COUNTED },
        { id: 911, oc_produto_id: 901, status: ITEM_STATUS.COUNTED },
        { id: 912, oc_produto_id: 901, status: ITEM_STATUS.COUNTED },
        { id: 913, oc_produto_id: 902, status: ITEM_STATUS.COUNTED },
        { id: 914, oc_produto_id: 903, status: ITEM_STATUS.COUNTED },
        { id: 915, oc_produto_id: 903, status: ITEM_STATUS.COUNTED },
        { id: 916, oc_produto_id: 903, status: ITEM_STATUS.COUNTED }
      ],
      ocAssignments: [
        { id: 990, oc_id: 90, ciclo: 2, fase: 'recontagem', estoquista_id: 33, status: 'ativo' }
      ],
      ocAssignmentProdutos: [
        { assignment_id: 990, oc_id: 90, oc_produto_id: 901 },
        { assignment_id: 990, oc_id: 90, oc_produto_id: 903 }
      ],
      counts: [
        { id: 1, oc_id: 90, oc_produto_id: 900, oc_localizacao_id: 910, assignment_id: 989, user_id: 22 },
        { id: 2, oc_id: 90, oc_produto_id: 901, oc_localizacao_id: 911, assignment_id: 990, user_id: 33 },
        { id: 3, oc_id: 90, oc_produto_id: 903, oc_localizacao_id: 914, assignment_id: 990, user_id: 33 },
        { id: 4, oc_id: 90, oc_produto_id: 902, oc_localizacao_id: 913, assignment_id: 989, user_id: 22 }
      ]
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1
    });

    expect(result.indicadores).toEqual({
      ocs_atribuidas: 1,
      ocs_em_andamento: 1,
      prontas_para_finalizar: 0
    });
    expect(result.proximas_ocs[0]).toMatchObject({
      id: 90,
      total_localizacoes: 5,
      localizacoes_contadas: 2,
      progresso_percentual: 40,
      pronta_para_finalizar: false
    });
    expect(JSON.stringify(result)).not.toContain('recontagem');
  });

  it('dashboard estoquista calcula pronta para finalizar no assignment ativo do modelo novo', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 33, nome: 'Recontador', role: 'estoquista', nivel_estoquista: 2 }
      ],
      ocs: [
        { id: 70, codigo: 'OC-00070', gestor_id: 11, estoquista_id: 22, empresa_id: 1, status: OC_STATUS.OPEN }
      ],
      ocProdutos: [
        { id: 700, oc_id: 70, descricao_snapshot: 'Produto A', status: ITEM_STATUS.COUNTED }
      ],
      ocLocalizacoes: [
        { id: 800, oc_produto_id: 700, status: ITEM_STATUS.COUNTED },
        { id: 801, oc_produto_id: 700, status: ITEM_STATUS.COUNTED }
      ],
      ocAssignments: [
        { id: 900, oc_id: 70, ciclo: 2, fase: 'recontagem', estoquista_id: 33, status: 'ativo' }
      ],
      ocAssignmentProdutos: [
        { assignment_id: 900, oc_id: 70, oc_produto_id: 700 }
      ],
      counts: [
        { id: 1, oc_id: 70, oc_produto_id: 700, oc_localizacao_id: 800, assignment_id: 900, user_id: 33 },
        { id: 2, oc_id: 70, oc_produto_id: 700, oc_localizacao_id: 801, assignment_id: 900, user_id: 33 }
      ]
    });
    const { service } = createService({ repository });

    const result = await service.getDashboardSummary({
      user: { id: 33, role: 'estoquista' },
      empresaId: 1
    });

    expect(result.indicadores).toEqual({
      ocs_atribuidas: 1,
      ocs_em_andamento: 0,
      prontas_para_finalizar: 1
    });
    expect(result.proximas_ocs[0]).toMatchObject({
      id: 70,
      total_localizacoes: 2,
      localizacoes_contadas: 2,
      pronta_para_finalizar: true
    });
    expect(JSON.stringify(result)).not.toContain('recontagem');
  });

  it.each([
    ['nivel 1', 22, 'A recontagem deve ser atribuida a um estoquista nivel 2'],
    ['nivel 3', 44, 'A recontagem deve ser atribuida a um estoquista nivel 2'],
    ['inativo', 55, 'O estoquista informado esta inativo'],
    ['sem empresa', 66, 'Usuario nao tem acesso a esta empresa']
  ])('rejeita recontador %s no backend', async (description, estoquistaId, message) => {
    const { repository, service, oc } = await createNewModelOcForRecount();
    const productId = repository.__getState().ocProdutos[0].id;

    await expect(service.sendOcToRecount({
      user: admin,
      empresaId: 1,
      ocId: oc.id,
      itemIds: [productId],
      novoEstoquistaId: estoquistaId
    })).rejects.toMatchObject({ message });
  });

  it('falha cedo quando repository nao implementa IOcRepository', () => {
    expect(() => createOcService({ repository: {} })).toThrow(TypeError);
  });
});


