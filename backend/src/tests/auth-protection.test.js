const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../config/db');
const userService = require('../modules/users/userService');
const ocService = require('../modules/ocs/ocService');
const authRepository = require('../modules/auth/authRepository');
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

jest.mock('../modules/auth/authRepository', () => ({
  findCurrentUserById: jest.fn()
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
  exportOcsCsv: jest.fn(),
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
  getOcHistoryDetails: jest.fn(),
  saveOcCount: jest.fn(),
  finalizeOc: jest.fn(),
  getOcOrFail: jest.fn()
}));

describe('Protecao de rotas autenticadas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authRepository.findCurrentUserById.mockImplementation(async (id) => {
      const users = {
        1: { id: 1, nome: 'Admin', role: 'admin', nivel_estoquista: null, ativo: true, empresas: [] },
        2: { id: 2, nome: 'Gestor', role: 'gestor', nivel_estoquista: null, ativo: true, empresas: [] },
        3: { id: 3, nome: 'Estoquista', role: 'estoquista', nivel_estoquista: 1, ativo: true, empresas: [] }
      };

      return users[id] || null;
    });
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
      expect(jwt.verify).toHaveBeenCalledWith(
        'token-invalido',
        expect.any(String),
        { algorithms: ['HS256'] }
      );
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

    it('com token valido de estoquista deve retornar 403', async () => {
      jwt.verify.mockReturnValue({
        id: 3,
        role: 'estoquista'
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-estoquista'));

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

    it('rejeita token emitido antes da desativacao do usuario', async () => {
      jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
      authRepository.findCurrentUserById.mockResolvedValue({
        id: 1,
        nome: 'Admin',
        role: 'admin',
        ativo: false,
        empresas: []
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-admin-antigo'));

      expect(response.status).toBe(401);
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('rejeita token valido de usuario que nao existe mais', async () => {
      jwt.verify.mockReturnValue({ id: 99, role: 'admin' });
      authRepository.findCurrentUserById.mockResolvedValue(null);

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-usuario-removido'));

      expect(response.status).toBe(401);
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('nao mascara erro inesperado do repository como token invalido', async () => {
      jwt.verify.mockReturnValue({ id: 1 });
      authRepository.findCurrentUserById.mockRejectedValue(new Error('database unavailable'));

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-valido'));

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Erro interno do servidor');
      expect(response.body.error.message).not.toContain('database unavailable');
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('rejeita token sem identidade valida', async () => {
      jwt.verify.mockReturnValue({ role: 'admin' });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-sem-id'));

      expect(response.status).toBe(401);
      expect(authRepository.findCurrentUserById).not.toHaveBeenCalled();
    });

    it('usa a role atual do banco e ignora a role admin antiga do token', async () => {
      jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
      authRepository.findCurrentUserById.mockResolvedValue({
        id: 1,
        nome: 'Ex-admin',
        role: 'gestor',
        nivel_estoquista: null,
        ativo: true,
        empresas: []
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-admin-antigo'));

      expect(response.status).toBe(403);
      expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('aplica imediatamente a promocao de gestor para admin segundo o banco', async () => {
      jwt.verify.mockReturnValue({ id: 2, role: 'gestor' });
      authRepository.findCurrentUserById.mockResolvedValue({
        id: 2,
        nome: 'Novo admin',
        role: 'admin',
        nivel_estoquista: null,
        ativo: true,
        empresas: []
      });
      userService.listUsers.mockResolvedValue([]);

      const response = await request(app)
        .get('/users')
        .set('Authorization', bearerToken('token-gestor-antigo'));

      expect(response.status).toBe(200);
      expect(userService.listUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /audit', () => {
    it('exige autenticacao', async () => {
      const response = await request(app).get('/audit');
      expect(response.status).toBe(401);
      expect(db.query).not.toHaveBeenCalled();
    });

    it.each([[2, 'gestor'], [3, 'estoquista']])('bloqueia o perfil %s', async (id, role) => {
      jwt.verify.mockReturnValue({ id, role });
      const response = await request(app).get('/audit').set('Authorization', bearerToken(`token-${role}`));
      expect(response.status).toBe(403);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('permite admin e retorna listagem global paginada', async () => {
      jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
      db.query.mockResolvedValueOnce({ rows: [{ total: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 10, action: 'oc.created' }] });
      const response = await request(app).get('/audit?page=1&limit=25').set('Authorization', bearerToken('token-admin'));
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [{ id: 10, action: 'oc.created' }], total: 1, page: 1, limit: 25, pages: 1 });
    });

    it.each(['/audit?page=0', '/audit?limit=0', '/audit?limit=101', '/audit?page=abc'])('rejeita paginacao invalida em %s', async (path) => {
      jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
      const response = await request(app).get(path).set('Authorization', bearerToken('token-admin'));
      expect(response.status).toBe(400);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('RBAC da Gestao de Usuarios', () => {
    const protectedOperations = [
      ['listar', 'get', '/users'],
      ['criar', 'post', '/users/register'],
      ['editar', 'put', '/users/2'],
      ['alterar status', 'patch', '/users/2/status']
    ];

    it.each(['gestor', 'estoquista'])('%s nao pode executar nenhuma operacao administrativa', async (role) => {
      jwt.verify.mockReturnValue({ id: role === 'gestor' ? 2 : 3, role });

      for (const [, method, path] of protectedOperations) {
        const response = await request(app)[method](path)
          .set('Authorization', bearerToken(`token-${role}`));

        expect(response.status).toBe(403);
      }

      expect(userService.listUsers).not.toHaveBeenCalled();
      expect(userService.registerUser).not.toHaveBeenCalled();
      expect(userService.updateUser).not.toHaveBeenCalled();
      expect(userService.updateUserStatus).not.toHaveBeenCalled();
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
          nome: 'Gestor',
          role: 'gestor',
          nivel_estoquista: null,
          empresas: []
        },
        empresaId: 1
      });
    });
  });

  describe('GET /ocs/export/csv', () => {
    it('retorna 401 sem autenticacao', async () => {
      const response = await request(app).get('/ocs/export/csv').set('x-empresa-id', '1');
      expect(response.status).toBe(401);
      expect(ocService.exportOcsCsv).not.toHaveBeenCalled();
    });

    it('retorna 403 para estoquista', async () => {
      jwt.verify.mockReturnValue({ id: 3, role: 'estoquista' });
      mockActiveEmpresaAccess();
      const response = await request(app).get('/ocs/export/csv').set('Authorization', bearerToken('token-estoquista')).set('x-empresa-id', '1');
      expect(response.status).toBe(403);
      expect(ocService.exportOcsCsv).not.toHaveBeenCalled();
    });

    it.each([[1, 'admin'], [2, 'gestor']])('permite %s e usa a empresa validada', async (id, role) => {
      jwt.verify.mockReturnValue({ id, role });
      mockActiveEmpresaAccess();
      ocService.exportOcsCsv.mockResolvedValue({ csv: '\uFEFF"OC"', filename: 'ocs-DIMEBRAS_PR-2026-08-17.csv', count: 0 });
      const response = await request(app).get('/ocs/export/csv?status=em_contagem&search=OC-1').set('Authorization', bearerToken(`token-${role}`)).set('x-empresa-id', '1');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('ocs-DIMEBRAS_PR-2026-08-17.csv');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(ocService.exportOcsCsv).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 1, filters: expect.objectContaining({ status: 'em_contagem', search: 'OC-1' }) }));
    });
  });

  describe('GET /ocs/historico/:id', () => {
    it('bloqueia estoquista na propria rota', async () => {
      jwt.verify.mockReturnValue({ id: 3, role: 'estoquista' });
      mockActiveEmpresaAccess();

      const response = await request(app)
        .get('/ocs/historico/10')
        .set('Authorization', bearerToken('token-estoquista'))
        .set('x-empresa-id', '1');

      expect(response.status).toBe(403);
      expect(ocService.getOcHistoryDetails).not.toHaveBeenCalled();
    });

    it.each([[1, 'admin'], [2, 'gestor']])('permite perfil administrativo %s', async (id, role) => {
      jwt.verify.mockReturnValue({ id, role });
      mockActiveEmpresaAccess();
      ocService.getOcHistoryDetails.mockResolvedValue({ oc: { id: 10 }, produtos: [], ciclos: [] });

      const response = await request(app)
        .get('/ocs/historico/10')
        .set('Authorization', bearerToken(`token-${role}`))
        .set('x-empresa-id', '1');

      expect(response.status).toBe(200);
      expect(ocService.getOcHistoryDetails).toHaveBeenCalledWith(expect.objectContaining({
        empresaId: 1,
        ocId: 10,
        user: expect.objectContaining({ id, role })
      }));
    });
  });

  describe('GET /auth/me', () => {
    it('retorna somente os dados publicos atuais da sessao', async () => {
      jwt.verify.mockReturnValue({ id: 3, role: 'admin' });
      authRepository.findCurrentUserById.mockResolvedValue({
        id: 3,
        nome: 'Estoquista',
        role: 'estoquista',
        nivel_estoquista: 2,
        ativo: true,
        empresas: [
          { id: 7, codigo: 'FILIAL_7', nome: 'Filial 7' },
          { id: 12, codigo: 'FILIAL_12', nome: 'Filial 12' }
        ]
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', bearerToken('token-antigo'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: 3,
          nome: 'Estoquista',
          role: 'estoquista',
          nivel_estoquista: 2,
          empresas: [
            { id: 7, codigo: 'FILIAL_7', nome: 'Filial 7' },
            { id: 12, codigo: 'FILIAL_12', nome: 'Filial 12' }
          ]
        }
      });
      expect(response.body.user).not.toHaveProperty('senha');
    });

    it('permite usuario ativo sem empresas vinculadas', async () => {
      jwt.verify.mockReturnValue({ id: 2 });
      authRepository.findCurrentUserById.mockResolvedValue({
        id: 2,
        nome: 'Gestor sem empresa',
        role: 'gestor',
        nivel_estoquista: null,
        ativo: true,
        empresas: []
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', bearerToken('token-sem-empresa'));

      expect(response.status).toBe(200);
      expect(response.body.user.empresas).toEqual([]);
    });
  });

  describe('POST /ocs/contar', () => {
    it('bloqueia imediatamente empresa inativa antes do fluxo operacional', async () => {
      jwt.verify.mockReturnValue({ id: 3, role: 'estoquista' });
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/ocs/contar')
        .set('Authorization', bearerToken('token-estoquista'))
        .set('x-empresa-id', '1')
        .send({ oc_id: 10, oc_localizacao_id: 20, quantidade: 1, lote: 'L1' });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('Empresa nao encontrada');
      expect(ocService.saveOcCount).not.toHaveBeenCalled();
    });

    it('bloqueia x-empresa-id antigo depois da remocao do vinculo', async () => {
      jwt.verify.mockReturnValue({ id: 3, role: 'estoquista' });
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR', ativo: true }]
        })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const response = await request(app)
        .post('/ocs/contar')
        .set('Authorization', bearerToken('token-estoquista'))
        .set('x-empresa-id', '1')
        .send({
          oc_id: 10,
          oc_localizacao_id: 20,
          quantidade: 1,
          lote: 'L1'
        });

      expect(response.status).toBe(403);
      expect(ocService.saveOcCount).not.toHaveBeenCalled();
    });

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
