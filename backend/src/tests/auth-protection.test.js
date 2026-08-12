const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../config/db');
const userService = require('../modules/users/userService');
const ocService = require('../modules/ocs/ocService');
const { bearerToken } = require('./helpers/auth');

function mockActiveEmpresaAccess() {
  db.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          codigo: 'DIMEBRAS_PR',
          nome: 'Dimebras PR',
          ativo: true
        }
      ]
    })
    .mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ exists: 1 }]
    });
}

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn()
}));

jest.mock('../modules/users/userService', () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  listUsers: jest.fn(),
  updateUser: jest.fn(),
  updateUserStatus: jest.fn(),
  deleteUser: jest.fn(),
  listEstoquistas: jest.fn()
}));

jest.mock('../modules/ocs/ocService', () => ({
  createOcWithItems: jest.fn(),
  listMyGestorOcs: jest.fn(),
  listOcsByGestor: jest.fn(),
  listMyEstoquistaOcs: jest.fn(),
  listOcsByEstoquista: jest.fn(),
  listApprovalForAdmin: jest.fn(),
  listMyApprovalOcs: jest.fn(),
  listApprovalForGestor: jest.fn(),
  approveOc: jest.fn(),
  sendOcToRecount: jest.fn(),
  listOcItems: jest.fn(),
  saveOcCount: jest.fn(),
  finalizeOc: jest.fn(),
  getOcOrFail: jest.fn()
}));

describe('Protecao de rotas autenticadas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('sem token deve retornar 401', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: expect.objectContaining({
          message: 'Token nao fornecido',
          code: 'AUTHENTICATION_ERROR',
          status: 401
        })
      });
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('com token invalido deve retornar 401', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Token invalido');
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-invalido'));

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: expect.objectContaining({
          message: 'Token invalido',
          code: 'AUTHENTICATION_ERROR',
          status: 401
        })
      });
      expect(jwt.verify).toHaveBeenCalledWith('token-invalido', expect.any(String));
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('com token valido de usuario sem role admin deve retornar 403', async () => {
      jwt.verify.mockReturnValue({
        id: 2,
        role: 'gestor'
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-gestor'));

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('com token valido de admin deve retornar 200', async () => {
      const users = [
        {
          id: 1,
          nome: 'Admin',
          login: 'admin',
          role: 'admin'
        }
      ];

      jwt.verify.mockReturnValue({
        id: 1,
        role: 'admin'
      });
      userService.listUsers.mockResolvedValue(users);

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-admin'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(users);
      expect(userService.listUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /ocs/minhas/gestor', () => {
    it('com token de estoquista deve retornar 403', async () => {
      jwt.verify.mockReturnValue({
        id: 3,
        role: 'estoquista'
      });
      mockActiveEmpresaAccess();

      const response = await request(app)
        .get('/ocs/minhas/gestor')
        .set('Authorization', bearerToken('token-estoquista'))
        .set('x-empresa-id', '1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(ocService.listMyGestorOcs).not.toHaveBeenCalled();
    });

    it('com token de gestor deve retornar 200', async () => {
      const ocs = [
        {
          id: 10,
          codigo: 'OC-00010',
          gestor_id: 2,
          status: 'aberta'
        }
      ];

      jwt.verify.mockReturnValue({
        id: 2,
        role: 'gestor'
      });
      ocService.listMyGestorOcs.mockResolvedValue(ocs);
      mockActiveEmpresaAccess();

      const response = await request(app)
        .get('/ocs/minhas/gestor')
        .set('Authorization', bearerToken('token-gestor'))
        .set('x-empresa-id', '1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(ocs);
      expect(ocService.listMyGestorOcs).toHaveBeenCalledWith({
        user: {
          id: 2,
          role: 'gestor'
        },
        empresaId: 1
      });
    });
  });

  describe('POST /ocs/contar', () => {
    it('rejeita quantidade vazia antes de chamar o service', async () => {
      jwt.verify.mockReturnValue({
        id: 3,
        role: 'estoquista'
      });
      mockActiveEmpresaAccess();

      const response = await request(app)
        .post('/ocs/contar')
        .set('Authorization', bearerToken('token-estoquista'))
        .set('x-empresa-id', '1')
        .send({
          oc_id: 10,
          oc_localizacao_id: 20,
          quantidade: '',
          lote: 'L1'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(ocService.saveOcCount).not.toHaveBeenCalled();
    });
  });
});
