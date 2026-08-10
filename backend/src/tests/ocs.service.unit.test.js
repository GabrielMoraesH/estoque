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
    ocHasNewModel: jest.fn().mockResolvedValue(false),
    listOperationalProducts: jest.fn(),
    listOperationalLocationsByProduct: jest.fn(),
    findLocalizacaoContextById: jest.fn().mockResolvedValue(null),
    findActiveFirstCountAssignment: jest.fn(),
    findCountByAssignmentAndLocation: jest.fn(),
    findLegacyItemForLocalizacao: jest.fn(),
    createNewModelCount: jest.fn(),
    updateLocalizacaoStatus: jest.fn(),
    updateProdutoStatusFromLocalizacoes: jest.fn(),
    getNewModelFinalizeValidation: jest.fn(),
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

  it('cria OC com itens dentro de transacao e registra auditoria', async () => {
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
      createOcAssignment: jest.fn().mockResolvedValue({}),
      createItem: jest.fn().mockResolvedValue({})
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
    expect(repository.createItem).toHaveBeenCalledTimes(2);
    expect(repository.createItem).toHaveBeenNthCalledWith(1, {
      ocId: 100,
      produto: 'Seringa',
      saldoSistema: 12,
      endereco: 'A1',
      codigo: 'SER',
      codigoBarras: null,
      validade: null,
      status: ITEM_STATUS.PENDING
    });
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
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      produto: 'Dipirona 500mg',
      endereco: 'A1-01-01',
      codigo: '789123',
      codigo_barras: '789123456789',
      validade: '2026-12-01'
    });
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
    expect(state.items).toHaveLength(3);
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
    expect(state.items).toHaveLength(4);
    expect(state.ocProdutos.find((item) => item.codigo === 'A')).toMatchObject({
      saldo_sistema_snapshot: 125
    });
    expect(state.ocLocalizacoes.map((item) => item.endereco_snapshot)).toContain('A1-01-01');
    expect(state.ocLocalizacoes.map((item) => item.endereco_snapshot)).not.toContain('Z9-99-99');
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

  it('conta localizacao no novo modelo com assignment e faz dual-write conservador', async () => {
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
      user_id: 22,
      quantidade: 0,
      lote: 'L1'
    });
    expect(state.counts).toHaveLength(1);
    expect(state.ocLocalizacoes[0].status).toBe(ITEM_STATUS.COUNTED);
    expect(state.ocProdutos[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.items[0]).toMatchObject({
      saldo_contado: 0,
      lote: 'L1',
      status: ITEM_STATUS.COUNTED
    });
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

  it('faz rollback da contagem nova se o dual-write legado falhar', async () => {
    const repository = createInMemoryOcRepository({
      users: [
        { id: 11, nome: 'Gestor', role: 'gestor', empresas: [{ id: 1 }] },
        { id: 22, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [{ id: 1 }] }
      ],
      failOnUpdateItemCount: true
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
    })).rejects.toThrow('item count update failed');

    const state = repository.__getState();
    expect(state.counts).toHaveLength(0);
    expect(state.ocLocalizacoes[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.ocProdutos[0].status).toBe(ITEM_STATUS.PENDING);
    expect(state.items[0]).toMatchObject({
      saldo_contado: null,
      lote: null,
      status: ITEM_STATUS.PENDING
    });
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
    })).rejects.toMatchObject({ statusCode: 404 });

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
    })).rejects.toMatchObject({ statusCode: 403 });

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
    const { repository, service, oc } = await createNewModelOcForCount();
    const locationId = repository.__getState().ocLocalizacoes[0].id;

    await service.saveOcCount({
      user: estoquista,
      empresaId: 1,
      payload: { oc_id: oc.id, oc_localizacao_id: locationId, quantidade: 7, lote: 'RET' }
    });
    repository.__getState().items[0].endereco = 'NAO_DEVE_APARECER';

    const items = await service.listOcItems({ user: estoquista, empresaId: 1, ocId: oc.id });
    const counted = items.find((item) => Number(item.oc_localizacao_id) === Number(locationId));

    expect(counted).toMatchObject({
      endereco: 'A1-01-01',
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

  it('falha cedo quando repository nao implementa IOcRepository', () => {
    expect(() => createOcService({ repository: {} })).toThrow(TypeError);
  });
});


