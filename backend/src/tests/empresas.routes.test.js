const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const empresaService = require('../modules/empresas/empresaService');
const authRepository = require('../modules/auth/authRepository');

jest.mock('jsonwebtoken', () => ({ ...jest.requireActual('jsonwebtoken'), verify: jest.fn() }));
jest.mock('../modules/auth/authRepository', () => ({ findCurrentUserById: jest.fn() }));
jest.mock('../modules/empresas/empresaService', () => ({
  listEmpresas: jest.fn(), listActiveEmpresas: jest.fn(), createEmpresa: jest.fn(),
  updateEmpresa: jest.fn(), updateEmpresaStatus: jest.fn(), assertUserHasEmpresaAccess: jest.fn()
}));

function authenticate(role) {
  const id = role === 'admin' ? 1 : role === 'gestor' ? 2 : 3;
  jwt.verify.mockReturnValue({ id });
  authRepository.findCurrentUserById.mockResolvedValue({ id, nome: role, role, ativo: true, empresas: [] });
  return `Bearer token-${role}`;
}

const operations = [
  { label: 'listar', method: 'get', path: '/empresas/admin', service: 'listEmpresas' },
  { label: 'criar', method: 'post', path: '/empresas', body: { codigo: 'EMP', nome: 'Empresa' }, service: 'createEmpresa', status: 201 },
  { label: 'editar', method: 'put', path: '/empresas/1', body: { nome: 'Empresa nova' }, service: 'updateEmpresa' },
  { label: 'alterar status', method: 'patch', path: '/empresas/1/status', body: { ativo: false }, service: 'updateEmpresaStatus' }
];

describe('RBAC administrativo de empresas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    empresaService.listEmpresas.mockResolvedValue([]);
    empresaService.createEmpresa.mockResolvedValue({ id: 1, codigo: 'EMP', nome: 'Empresa', ativo: true });
    empresaService.updateEmpresa.mockResolvedValue({ id: 1, codigo: 'EMP', nome: 'Empresa nova', ativo: true });
    empresaService.updateEmpresaStatus.mockResolvedValue({ id: 1, codigo: 'EMP', nome: 'Empresa', ativo: false });
  });

  describe.each(operations)('$label', (operation) => {
    it('retorna 401 sem autenticacao', async () => {
      const response = await request(app)[operation.method](operation.path).send(operation.body);
      expect(response.status).toBe(401);
      expect(empresaService[operation.service]).not.toHaveBeenCalled();
    });

    it.each(['gestor', 'estoquista'])('retorna 403 para %s', async (role) => {
      const response = await request(app)[operation.method](operation.path)
        .set('Authorization', authenticate(role)).send(operation.body);
      expect(response.status).toBe(403);
      expect(empresaService[operation.service]).not.toHaveBeenCalled();
    });

    it('permite admin', async () => {
      const response = await request(app)[operation.method](operation.path)
        .set('Authorization', authenticate('admin')).send(operation.body);
      expect(response.status).toBe(operation.status || 200);
      expect(empresaService[operation.service]).toHaveBeenCalledTimes(1);
    });
  });

  it('preserva GET /empresas como listagem autenticada somente de ativas', async () => {
    empresaService.listActiveEmpresas.mockResolvedValue([{ id: 1, ativo: true }]);
    const response = await request(app).get('/empresas').set('Authorization', authenticate('gestor'));
    expect(response.status).toBe(200);
    expect(empresaService.listActiveEmpresas).toHaveBeenCalledTimes(1);
    expect(empresaService.listEmpresas).not.toHaveBeenCalled();
  });

  it.each([
    { codigo: '', nome: 'Empresa' }, { codigo: 'A'.repeat(41), nome: 'Empresa' },
    { codigo: 'EMP', nome: '' }, { codigo: 'EMP', nome: 'A'.repeat(121) },
    { codigo: 'EMP', nome: 'Empresa', ativo: false, id: 999 }
  ])('rejeita criacao invalida ou hostil: %j', async (body) => {
    const response = await request(app).post('/empresas').set('Authorization', authenticate('admin')).send(body);
    expect(response.status).toBe(400);
    expect(empresaService.createEmpresa).not.toHaveBeenCalled();
  });

  it('aplica trim sem alterar case ou caracteres do codigo', async () => {
    await request(app).post('/empresas').set('Authorization', authenticate('admin'))
      .send({ codigo: ' abc-01_x ', nome: ' Empresa ' });
    expect(empresaService.createEmpresa).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'abc-01_x', nome: 'Empresa' }));
  });

  it.each([{ nome: '' }, { nome: 'A'.repeat(121) }, { nome: 'Novo', codigo: 'ALTERADO' }, { nome: 'Novo', ativo: false }])('rejeita edicao invalida ou hostil: %j', async (body) => {
    const response = await request(app).put('/empresas/1').set('Authorization', authenticate('admin')).send(body);
    expect(response.status).toBe(400);
    expect(empresaService.updateEmpresa).not.toHaveBeenCalled();
  });

  it('aplica trim ao nome editado', async () => {
    await request(app).put('/empresas/1').set('Authorization', authenticate('admin')).send({ nome: ' Novo nome ' });
    expect(empresaService.updateEmpresa).toHaveBeenCalledWith(expect.objectContaining({ id: 1, nome: 'Novo nome' }));
  });

  it.each([{ ativo: 'false' }, { ativo: false, id: 9 }, {}, { ativo: null }])('rejeita payload de status hostil: %j', async (body) => {
    const response = await request(app).patch('/empresas/1/status').set('Authorization', authenticate('admin')).send(body);
    expect(response.status).toBe(400);
    expect(empresaService.updateEmpresaStatus).not.toHaveBeenCalled();
  });
});
