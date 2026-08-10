const { createOcService } = require('../modules/ocs/oc.service');
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
    createItem: jest.fn(),
    listByGestor: jest.fn(),
    listByEstoquista: jest.fn(),
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

  it('cria OC com itens dentro de transacao e registra auditoria', async () => {
    const repository = createRepositoryMock({
      findUserById: jest.fn().mockResolvedValue({ id: 22, role: 'estoquista' }),
      getNextIdentity: jest.fn().mockResolvedValue({ nextId: 100, codigo: 'OC-000100' }),
      createOc: jest.fn().mockResolvedValue({
        id: 100,
        codigo: 'OC-000100',
        gestor_id: 11,
        estoquista_id: 22,
        empresa_id: 1,
        status: OC_STATUS.OPEN
      }),
      createItem: jest.fn().mockResolvedValue({})
    });
    const { service, audit } = createService({ repository });

    await expect(service.createOcWithItems({
      user: gestor,
      empresaId: 1,
      payload: {
        estoquista_id: 22,
        items: [
          { produto: 'Seringa', saldo_sistema: 12 },
          { produto: 'Luva', saldo_sistema: 30 }
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
    expect(repository.createItem).toHaveBeenCalledTimes(2);
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
        items: [{ produto: 'Seringa', saldo_sistema: 12 }]
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
        items: [{ produto: 'Seringa', saldo_sistema: 12 }]
      }
    })).rejects.toBe(transactionError);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('lista OCs do gestor logado e aplica filtros do repository', async () => {
    const result = [{ id: 1, codigo: 'OC-1' }];
    const repository = createRepositoryMock({
      listByGestor: jest.fn().mockResolvedValue(result)
    });
    const { service } = createService({ repository });

    await expect(service.listMyGestorOcs({ user: gestor, empresaId: 1 })).resolves.toEqual(result);
    expect(repository.listByGestor).toHaveBeenCalledWith({ gestorId: 11, empresaId: 1 });
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

  it('falha cedo quando repository nao implementa IOcRepository', () => {
    expect(() => createOcService({ repository: {} })).toThrow(TypeError);
  });
});


