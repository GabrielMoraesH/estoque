const { createEmpresaService } = require('../modules/empresas/empresaService');

describe('EmpresaService unitario com repository mockado', () => {
  it('lista empresas ativas pelo repository', async () => {
    const empresas = [
      {
        id: 5,
        codigo: 'ALFAMED_MS',
        nome: 'Alfamed MS',
        ativo: true
      }
    ];
    const repository = {
      listActive: jest.fn().mockResolvedValue(empresas)
    };
    const service = createEmpresaService({ repository });

    await expect(service.listEmpresas()).resolves.toEqual(empresas);
    expect(repository.listActive).toHaveBeenCalledTimes(1);
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
});
