const { createEmpresaService } = require('../modules/empresas/empresaService');

describe('EmpresaService unitario com repository mockado', () => {
  it('lista empresas para administracao pelo repository', async () => {
    const empresas = [
      {
        id: 5,
        codigo: 'ALFAMED_MS',
        nome: 'Alfamed MS',
        ativo: true
      }
    ];
    const repository = {
      listAdmin: jest.fn().mockResolvedValue(empresas)
    };
    const service = createEmpresaService({ repository });

    await expect(service.listEmpresas()).resolves.toEqual(empresas);
    expect(repository.listAdmin).toHaveBeenCalledTimes(1);
  });

  it('cria empresa e converte codigo duplicado em conflito de dominio', async () => {
    const repository = { create: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: '23505' })) };
    const service = createEmpresaService({ repository });
    await expect(service.createEmpresa({ codigo: 'A', nome: 'Empresa A' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'Codigo de empresa ja existe'
    });
  });

  it('inativa empresa preservando vinculos e registrando auditoria best-effort', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 4, codigo: 'EMP', ativo: true }),
      updateStatus: jest.fn().mockResolvedValue({ id: 4, codigo: 'EMP', nome: 'Empresa', ativo: false })
    };
    const audit = { logAction: jest.fn().mockRejectedValue(new Error('audit unavailable')) };
    const service = createEmpresaService({ repository, audit });

    await expect(service.updateEmpresaStatus({ id: 4, ativo: false, actor: { id: 1 } })).resolves.toMatchObject({ ativo: false });
    expect(repository.updateStatus).toHaveBeenCalledWith({ id: 4, ativo: false });
  });

  it('retorna ids das empresas vinculadas ao usuario', async () => {
    const repository = {
      listUserEmpresaIds: jest.fn().mockResolvedValue([1, 2, 3])
    };
    const service = createEmpresaService({ repository });

    await expect(service.getUserEmpresaIds(10)).resolves.toEqual([1, 2, 3]);
    expect(repository.listUserEmpresaIds).toHaveBeenCalledWith(10);
  });

  it('retorna a empresa quando o usuario tem acesso', async () => {
    const empresa = {
      id: 1,
      codigo: 'DIMEBRAS_PR',
      nome: 'Dimebras PR',
      ativo: true
    };
    const repository = {
      findActiveById: jest.fn().mockResolvedValue(empresa),
      userHasEmpresaAccess: jest.fn().mockResolvedValue(true)
    };
    const service = createEmpresaService({ repository });

    await expect(service.assertUserHasEmpresaAccess(7, 1)).resolves.toEqual(empresa);
    expect(repository.findActiveById).toHaveBeenCalledWith(1);
    expect(repository.userHasEmpresaAccess).toHaveBeenCalledWith(7, 1);
  });

  it('lanca 404 quando a empresa nao existe ou esta inativa', async () => {
    const repository = {
      findActiveById: jest.fn().mockResolvedValue(null),
      userHasEmpresaAccess: jest.fn()
    };
    const service = createEmpresaService({ repository });

    await expect(service.assertUserHasEmpresaAccess(7, 999)).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'NOT_FOUND'
    });
    expect(repository.userHasEmpresaAccess).not.toHaveBeenCalled();
  });

  it('lanca 403 quando o usuario nao possui vinculo com a empresa', async () => {
    const repository = {
      findActiveById: jest.fn().mockResolvedValue({ id: 1 }),
      userHasEmpresaAccess: jest.fn().mockResolvedValue(false)
    };
    const service = createEmpresaService({ repository });

    await expect(service.assertUserHasEmpresaAccess(7, 1)).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'AUTHORIZATION_ERROR'
    });
  });

  it('mantem contrato operacional separado com somente empresas ativas', async () => {
    const repository = { listActive: jest.fn().mockResolvedValue([{ id: 2, ativo: true }]) };
    const service = createEmpresaService({ repository });
    await expect(service.listActiveEmpresas()).resolves.toEqual([{ id: 2, ativo: true }]);
    expect(repository.listActive).toHaveBeenCalledTimes(1);
  });

  it('audita criacao bem-sucedida com metadata minima', async () => {
    const empresa = { id: 9, codigo: 'abc-01', nome: 'Empresa', ativo: true };
    const repository = { create: jest.fn().mockResolvedValue(empresa) };
    const audit = { logAction: jest.fn().mockResolvedValue() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.createEmpresa({ codigo: 'abc-01', nome: 'Empresa', actor: { id: 1, role: 'admin' } })).resolves.toEqual(empresa);
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'empresa.created', entityType: 'empresa', entityId: 9, metadata: { empresa_id: 9, codigo: 'abc-01' } }));
  });

  it('edita somente o nome e audita depois do sucesso', async () => {
    const previous = { id: 3, codigo: 'FIXO', nome: 'Anterior', ativo: true };
    const updated = { ...previous, nome: 'Atual' };
    const repository = { findById: jest.fn().mockResolvedValue(previous), updateName: jest.fn().mockResolvedValue(updated) };
    const audit = { logAction: jest.fn().mockResolvedValue() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.updateEmpresa({ id: 3, nome: 'Atual', actor: { id: 1 } })).resolves.toEqual(updated);
    expect(repository.updateName).toHaveBeenCalledWith({ id: 3, nome: 'Atual' });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'empresa.updated', entityId: 3 }));
  });

  it('nao grava nem audita edicao sem mudanca', async () => {
    const empresa = { id: 3, codigo: 'FIXO', nome: 'Igual', ativo: true };
    const repository = { findById: jest.fn().mockResolvedValue(empresa), updateName: jest.fn() };
    const audit = { logAction: jest.fn() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.updateEmpresa({ id: 3, nome: 'Igual' })).resolves.toEqual(empresa);
    expect(repository.updateName).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('retorna 404 e nao audita edicao de empresa inexistente', async () => {
    const repository = { findById: jest.fn().mockResolvedValue(null), updateName: jest.fn() };
    const audit = { logAction: jest.fn() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.updateEmpresa({ id: 99, nome: 'Nova' })).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.updateName).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it.each([[false, 'empresa.deactivated'], [true, 'empresa.reactivated']])('audita uma transicao real para ativo=%s', async (ativo, action) => {
    const previous = { id: 4, codigo: 'EMP', nome: 'Empresa', ativo: !ativo };
    const updated = { ...previous, ativo };
    const repository = { findById: jest.fn().mockResolvedValue(previous), updateStatus: jest.fn().mockResolvedValue(updated) };
    const audit = { logAction: jest.fn().mockResolvedValue() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.updateEmpresaStatus({ id: 4, ativo, actor: { id: 1 } })).resolves.toEqual(updated);
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({ action, entityType: 'empresa', entityId: 4 }));
  });

  it('trata status identico como sucesso idempotente sem update ou evento', async () => {
    const empresa = { id: 4, codigo: 'EMP', nome: 'Empresa', ativo: false };
    const repository = { findById: jest.fn().mockResolvedValue(empresa), updateStatus: jest.fn() };
    const audit = { logAction: jest.fn() };
    const service = createEmpresaService({ repository, audit });
    await expect(service.updateEmpresaStatus({ id: 4, ativo: false })).resolves.toEqual(empresa);
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });
});
