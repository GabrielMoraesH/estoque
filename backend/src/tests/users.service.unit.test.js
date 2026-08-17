const { createUserService } = require('../modules/users/user.service');
const { createUserRepository } = require('../modules/users/user.repository');
const { createInMemoryUserRepository } = require('../modules/users/in-memory-user.repository');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

function createRepositoryMock(overrides = {}) {
  const repository = {
    create: jest.fn(),
    findByLogin: jest.fn(),
    findSummaryById: jest.fn(),
    findActiveEmpresaIds: jest.fn(async (empresaIds) => empresaIds),
    listActiveEmpresasByUserId: jest.fn().mockResolvedValue([
      { id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }
    ]),
    replaceUserEmpresas: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    deleteById: jest.fn(),
    listEstoquistas: jest.fn(),
    ...overrides
  };

  repository.withTransaction = overrides.withTransaction || jest.fn(async (callback) => callback(repository));

  return repository;
}

function createService({ repository = createRepositoryMock(), audit, passwordHasher, tokenProvider } = {}) {
  const dependencies = {
    repository,
    audit: audit || { logAction: jest.fn().mockResolvedValue(undefined) },
    passwordHasher: passwordHasher || {
      hash: jest.fn(async (value) => `hashed:${value}`),
      compare: jest.fn(async (value, hashedValue) => hashedValue === `hashed:${value}`)
    },
    tokenProvider: tokenProvider || {
      sign: jest.fn(() => 'jwt-token')
    },
    security: {
      bcryptSaltRounds: 4,
      jwtSecret: 'unit-test-secret',
      jwtExpiresIn: '15m',
      jwtAlgorithm: 'HS256'
    }
  };

  return {
    service: createUserService(dependencies),
    ...dependencies
  };
}

describe('UserService unitario com repository mockado', () => {
  it('registra usuario com senha criptografada e auditoria', async () => {
    const createdUser = { id: 10, nome: 'Ana', login: 'ana', role: 'gestor', empresas: [] };
    const savedUser = {
      ...createdUser,
      empresas: [{ id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }]
    };
    const repository = createRepositoryMock({
      create: jest.fn().mockResolvedValue(createdUser),
      findActiveEmpresaIds: jest.fn().mockResolvedValue([1]),
      replaceUserEmpresas: jest.fn().mockResolvedValue(undefined),
      findSummaryById: jest.fn().mockResolvedValue(savedUser)
    });
    const { service, passwordHasher, audit } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor',
      empresa_ids: [1],
      actor: { id: 1, role: 'admin' },
      auditContext: { requestId: 'req-1' }
    })).resolves.toEqual(savedUser);

    expect(passwordHasher.hash).toHaveBeenCalledWith('123456', 4);
    expect(repository.create).toHaveBeenCalledWith({
      nome: 'Ana',
      login: 'ana',
      senha: 'hashed:123456',
      role: 'gestor',
      nivel_estoquista: null
    });
    expect(repository.findActiveEmpresaIds).toHaveBeenCalledWith([1]);
    expect(repository.replaceUserEmpresas).toHaveBeenCalledWith(10, [1]);
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.created',
      entityType: 'user',
      entityId: 10,
      metadata: expect.objectContaining({
        empresa_ids: [1]
      })
    }));
  });

  it('converte login duplicado em erro de regra de negocio', async () => {
    const duplicateError = new Error('duplicate key');
    duplicateError.code = '23505';
    const repository = createRepositoryMock({
      create: jest.fn().mockRejectedValue(duplicateError)
    });
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor',
      empresa_ids: [1]
    })).rejects.toMatchObject({
      message: 'Login ja existe',
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT
    });
  });

  it.each([
    ['vazia', ''],
    ['menor que 6 caracteres', '12345']
  ])('rejeita criacao com senha %s', async (_description, senha) => {
    const repository = createRepositoryMock();
    const { service, passwordHasher } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha,
      role: 'gestor',
      empresa_ids: [1]
    })).rejects.toMatchObject({
      message: 'Senha deve possuir no minimo 6 caracteres',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('propaga excecao inesperada do repository ao registrar usuario', async () => {
    const databaseError = new Error('database unavailable');
    const repository = createRepositoryMock({
      create: jest.fn().mockRejectedValue(databaseError)
    });
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor',
      empresa_ids: [1]
    })).rejects.toBe(databaseError);
  });

  it('loga usuario valido e gera token sem expor senha', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue({
        id: 3,
        nome: 'Carlos',
        login: 'carlos',
        senha: 'hashed:secret',
        role: 'estoquista'
      })
    });
    const { service, passwordHasher, tokenProvider } = createService({ repository });

    await expect(service.loginUser({
      login: 'carlos',
      senha: 'secret'
    })).resolves.toEqual({
      token: 'jwt-token',
      user: {
        id: 3,
        nome: 'Carlos',
        role: 'estoquista',
        empresas: [
          { id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }
        ]
      }
    });

    expect(passwordHasher.compare).toHaveBeenCalledWith('secret', 'hashed:secret');
    expect(repository.listActiveEmpresasByUserId).toHaveBeenCalledWith(3);
    expect(tokenProvider.sign).toHaveBeenCalledWith(
      { id: 3 },
      'unit-test-secret',
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  });

  it('retorna erro de validacao quando login nao existe', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue(null)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.loginUser({
      login: 'nao-existe',
      senha: 'secret'
    })).rejects.toMatchObject({
      message: 'Usuario nao encontrado',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('retorna erro de validacao quando senha e invalida', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue({
        id: 3,
        nome: 'Carlos',
        senha: 'hashed:secret',
        role: 'estoquista'
      })
    });
    const { service, tokenProvider } = createService({ repository });

    await expect(service.loginUser({
      login: 'carlos',
      senha: 'errada'
    })).rejects.toMatchObject({
      message: 'Senha invalida',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(tokenProvider.sign).not.toHaveBeenCalled();
  });

  it('bloqueia login quando usuario nao possui empresa ativa vinculada', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue({
        id: 3,
        nome: 'Carlos',
        senha: 'hashed:secret',
        role: 'estoquista'
      }),
      listActiveEmpresasByUserId: jest.fn().mockResolvedValue([])
    });
    const { service, tokenProvider } = createService({ repository });

    await expect(service.loginUser({
      login: 'carlos',
      senha: 'secret'
    })).rejects.toMatchObject({
      message: 'Usuario sem empresa vinculada',
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(tokenProvider.sign).not.toHaveBeenCalled();
  });

  it('bloqueia login quando usuario esta desativado', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue({
        id: 3,
        nome: 'Carlos',
        senha: 'hashed:secret',
        role: 'estoquista',
        ativo: false
      })
    });
    const { service, passwordHasher, tokenProvider } = createService({ repository });

    await expect(service.loginUser({
      login: 'carlos',
      senha: 'secret'
    })).rejects.toMatchObject({
      message: 'Usuário desativado. Entre em contato com o administrador.',
      statusCode: 403,
      errorCode: ERROR_CODES.AUTHORIZATION_ERROR
    });
    expect(passwordHasher.compare).not.toHaveBeenCalled();
    expect(tokenProvider.sign).not.toHaveBeenCalled();
  });

  it('atualiza usuario sem alterar senha quando campo vem vazio', async () => {
    const currentUser = { id: 7, nome: 'Bia', login: 'bia', role: 'gestor' };
    const updatedUser = { ...currentUser, nome: 'Beatriz' };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      update: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, passwordHasher, audit } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Beatriz',
      login: 'bia',
      role: 'gestor',
      senha: '   ',
      actor: { id: 1, role: 'admin' }
    })).resolves.toEqual(updatedUser);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith({
      id: 7,
      nome: 'Beatriz',
      login: 'bia',
      role: 'gestor',
      nivel_estoquista: null,
      senha: null
    });
    expect(repository.replaceUserEmpresas).not.toHaveBeenCalled();
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.updated',
      metadata: expect.objectContaining({ password_changed: false })
    }));
  });

  it('atualiza usuario sem alterar senha quando campo e omitido', async () => {
    const currentUser = { id: 7, nome: 'Bia', login: 'bia', role: 'gestor' };
    const updatedUser = { ...currentUser, login: 'beatriz' };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      update: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Bia',
      login: 'beatriz',
      role: 'gestor'
    })).resolves.toEqual(updatedUser);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({
      senha: null
    }));
  });

  it.each(['gestor', 'estoquista'])('impede admin de alterar o proprio perfil para %s', async (role) => {
    const currentUser = { id: 7, nome: 'Admin', login: 'admin', role: 'admin' };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn().mockResolvedValue(currentUser)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Admin',
      login: 'admin',
      role,
      empresa_ids: [1],
      actor: { id: 7, role: 'admin' }
    })).rejects.toMatchObject({
      message: 'Voce nao pode alterar o perfil do seu proprio usuario',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.replaceUserEmpresas).not.toHaveBeenCalled();
  });

  it('permite admin editar os proprios dados mantendo o perfil admin', async () => {
    const currentUser = { id: 7, nome: 'Admin', login: 'admin', role: 'admin', empresas: [{ id: 1 }] };
    const updatedUser = { ...currentUser, nome: 'Administradora', login: 'admin.novo', empresas: [{ id: 2 }] };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      update: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Administradora',
      login: 'admin.novo',
      role: 'admin',
      senha: 'nova-senha',
      empresa_ids: [2],
      actor: { id: 7, role: 'admin' }
    })).resolves.toEqual(updatedUser);

    expect(passwordHasher.hash).toHaveBeenCalledWith('nova-senha', 4);
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      role: 'admin',
      senha: 'hashed:nova-senha'
    }));
    expect(repository.replaceUserEmpresas).toHaveBeenCalledWith(7, [2]);
  });

  it('rejeita edicao com nova senha menor que 6 caracteres', async () => {
    const currentUser = { id: 7, nome: 'Bia', login: 'bia', role: 'gestor' };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn().mockResolvedValue(currentUser)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      senha: '12345'
    })).rejects.toMatchObject({
      message: 'Senha deve possuir no minimo 6 caracteres',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('atualiza senha quando nova senha possui ao menos 6 caracteres', async () => {
    const currentUser = { id: 7, nome: 'Bia', login: 'bia', role: 'gestor' };
    const updatedUser = { ...currentUser };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      update: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, passwordHasher } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      senha: 'abcdef'
    })).resolves.toEqual(updatedUser);

    expect(passwordHasher.hash).toHaveBeenCalledWith('abcdef', 4);
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({
      senha: 'hashed:abcdef'
    }));
  });

  it('converte login duplicado na edicao em erro de dominio sem alteracao parcial', async () => {
    const duplicateError = new Error('duplicate key value violates unique constraint');
    duplicateError.code = '23505';
    const currentUser = { id: 7, nome: 'Bia', login: 'bia', role: 'gestor' };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn().mockResolvedValue(currentUser),
      update: jest.fn().mockRejectedValue(duplicateError)
    });
    const { service } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Bia',
      login: 'login.existente',
      role: 'gestor',
      empresa_ids: [1],
      actor: { id: 1, role: 'admin' }
    })).rejects.toMatchObject({
      message: 'Login ja existe',
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT
    });

    expect(repository.replaceUserEmpresas).not.toHaveBeenCalled();
  });

  it('retorna not found ao atualizar usuario inexistente', async () => {
    const repository = createRepositoryMock({
      findSummaryById: jest.fn().mockResolvedValue(null)
    });
    const { service } = createService({ repository });

    await expect(service.updateUser({
      id: 999,
      nome: 'Nao existe',
      login: 'missing',
      role: 'gestor',
      empresa_ids: [1]
    })).rejects.toMatchObject({
      message: 'Usuario nao encontrado',
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('registra estoquista com nivel informado', async () => {
    const createdUser = {
      id: 12,
      nome: 'Eli',
      login: 'eli',
      role: 'estoquista',
      nivel_estoquista: 2
    };
    const repository = createRepositoryMock({
      create: jest.fn().mockResolvedValue(createdUser),
      findSummaryById: jest.fn().mockResolvedValue(createdUser)
    });
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Eli',
      login: 'eli',
      senha: '123456',
      role: 'estoquista',
      nivel_estoquista: 2,
      empresa_ids: [1]
    })).resolves.toEqual(createdUser);

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      role: 'estoquista',
      nivel_estoquista: 2
    }));
  });

  it('exige nivel valido para estoquista', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Eli',
      login: 'eli',
      senha: '123456',
      role: 'estoquista',
      empresa_ids: [1]
    })).rejects.toMatchObject({
      message: 'Informe o nivel do estoquista',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('impede excluir o proprio usuario', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.deleteUser({
      id: '4',
      loggedUserId: 4
    })).rejects.toMatchObject({
      message: 'Voce nao pode excluir seu proprio usuario',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('desativa usuario e registra auditoria', async () => {
    const currentUser = {
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      ativo: true
    };
    const updatedUser = { ...currentUser, ativo: false };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      updateStatus: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, audit } = createService({ repository });

    await expect(service.updateUserStatus({
      id: 7,
      ativo: false,
      actor: { id: 1, role: 'admin' },
      auditContext: { requestId: 'req-status' }
    })).resolves.toEqual(updatedUser);

    expect(repository.updateStatus).toHaveBeenCalledWith({ id: 7, ativo: false });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.deactivated',
      entityType: 'user',
      entityId: 7,
      metadata: {
        target_user_id: 7,
        target_login: 'bia'
      }
    }));
  });

  it('reativa usuario e registra auditoria', async () => {
    const currentUser = {
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      ativo: false
    };
    const updatedUser = { ...currentUser, ativo: true };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      updateStatus: jest.fn().mockResolvedValue(updatedUser)
    });
    const { service, audit } = createService({ repository });

    await expect(service.updateUserStatus({
      id: 7,
      ativo: true,
      actor: { id: 1, role: 'admin' }
    })).resolves.toEqual(updatedUser);

    expect(repository.updateStatus).toHaveBeenCalledWith({ id: 7, ativo: true });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.reactivated',
      metadata: {
        target_user_id: 7,
        target_login: 'bia'
      }
    }));
  });

  it('impede desativar o proprio usuario', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.updateUserStatus({
      id: '4',
      ativo: false,
      actor: { id: 4, role: 'admin' }
    })).rejects.toMatchObject({
      message: 'Voce nao pode desativar seu proprio usuario',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('exige ao menos uma empresa ao registrar usuario', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor'
    })).rejects.toMatchObject({
      message: 'Informe ao menos uma empresa de acesso',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejeita empresas duplicadas ao registrar usuario', async () => {
    const repository = createRepositoryMock();
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor',
      empresa_ids: [1, 1]
    })).rejects.toMatchObject({
      message: 'Empresas de acesso nao podem ser duplicadas',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
  });

  it('rejeita empresas inexistentes ou inativas ao registrar usuario', async () => {
    const repository = createRepositoryMock({
      findActiveEmpresaIds: jest.fn().mockResolvedValue([1])
    });
    const { service } = createService({ repository });

    await expect(service.registerUser({
      nome: 'Ana',
      login: 'ana',
      senha: '123456',
      role: 'gestor',
      empresa_ids: [1, 999]
    })).rejects.toMatchObject({
      message: 'Uma ou mais empresas informadas nao existem ou estao inativas',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
  });

  it('substitui empresas do usuario quando empresa_ids e enviado na edicao', async () => {
    const currentUser = {
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      empresas: [{ id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }]
    };
    const updatedUser = {
      ...currentUser,
      empresas: [{ id: 6, codigo: 'DIMEBRAS_SC', nome: 'Dimebras SC' }]
    };
    const repository = createRepositoryMock({
      findSummaryById: jest.fn()
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(updatedUser),
      findActiveEmpresaIds: jest.fn().mockResolvedValue([6]),
      update: jest.fn().mockResolvedValue({ ...currentUser, empresas: [] }),
      replaceUserEmpresas: jest.fn().mockResolvedValue(undefined)
    });
    const { service, audit } = createService({ repository });

    await expect(service.updateUser({
      id: 7,
      nome: 'Bia',
      login: 'bia',
      role: 'gestor',
      empresa_ids: [6]
    })).resolves.toEqual(updatedUser);

    expect(repository.findActiveEmpresaIds).toHaveBeenCalledWith([6]);
    expect(repository.replaceUserEmpresas).toHaveBeenCalledWith(7, [6]);
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        empresa_ids: [6]
      })
    }));
  });

  it('lista estoquistas ativos filtrando empresa e nivel quando informado', async () => {
    const repository = createRepositoryMock({
      listEstoquistas: jest.fn().mockResolvedValue([
        { id: 1, nome: 'Nivel 1', nivel_estoquista: 1, ativo: true, empresas: [{ id: 2 }] }
      ])
    });
    const { service } = createService({ repository });

    await expect(service.listEstoquistas({
      empresaId: 2,
      nivel: '1'
    })).resolves.toEqual([
      { id: 1, nome: 'Nivel 1', nivel_estoquista: 1, ativo: true, empresas: [{ id: 2 }] }
    ]);

    expect(repository.listEstoquistas).toHaveBeenCalledWith({
      empresaId: 2,
      nivel: 1
    });
  });

  it('mantem role no contrato de estoquistas dos repositories PostgreSQL e in-memory', async () => {
    const postgresDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 3,
          nome: 'Estoquista',
          role: 'estoquista',
          ativo: true,
          nivel_estoquista: 1,
          empresas: [{ id: 2 }]
        }]
      })
    };
    const postgresRepository = createUserRepository(postgresDb);
    const postgresResult = await postgresRepository.listEstoquistas({ empresaId: 2, nivel: 1 });
    const [query] = postgresDb.query.mock.calls[0];
    const inMemoryRepository = createInMemoryUserRepository({
      users: [{
        id: 3,
        nome: 'Estoquista',
        role: 'estoquista',
        ativo: true,
        nivel_estoquista: 1,
        empresas: [{ id: 2 }]
      }]
    });

    expect(query).toMatch(/users\.role,\s+users\.ativo/);
    expect(postgresResult[0]).toMatchObject({
      role: 'estoquista',
      ativo: true,
      nivel_estoquista: 1,
      empresas: [{ id: 2 }]
    });
    await expect(inMemoryRepository.listEstoquistas({ empresaId: 2, nivel: 1 }))
      .resolves
      .toEqual([expect.objectContaining({
        role: 'estoquista',
        ativo: true,
        nivel_estoquista: 1,
        empresas: [{ id: 2 }]
      })]);
  });

  it('converte violacao de chave estrangeira ao excluir usuario', async () => {
    const foreignKeyError = new Error('foreign key');
    foreignKeyError.code = '23503';
    const repository = createRepositoryMock({
      deleteById: jest.fn().mockRejectedValue(foreignKeyError)
    });
    const { service } = createService({ repository });

    await expect(service.deleteUser({
      id: 5,
      loggedUserId: 1
    })).rejects.toMatchObject({
      message: 'Nao foi possivel excluir este usuario porque ele possui registros vinculados',
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR
    });
  });

  it('falha cedo quando repository nao implementa IUserRepository', () => {
    expect(() => createUserService({ repository: {} })).toThrow(TypeError);
  });

  it('executa rollback e nao commit quando uma etapa transacional falha', async () => {
    const transactionError = new Error('falha ao substituir empresas');
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    };
    const db = {
      connect: jest.fn().mockResolvedValue(client),
      query: jest.fn()
    };
    const repository = createUserRepository(db);

    await expect(repository.withTransaction(async () => {
      throw transactionError;
    })).rejects.toBe(transactionError);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('mantem AppError operacional para asserts explicitos de erro', async () => {
    const repository = createRepositoryMock({
      findByLogin: jest.fn().mockResolvedValue(null)
    });
    const { service } = createService({ repository });

    await expect(service.loginUser({ login: 'x', senha: 'y' }))
      .rejects
      .toBeInstanceOf(AppError);
  });
});
