const request = require('supertest');
const app = require('../app');
const userService = require('../modules/users/userService');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  end: jest.fn()
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

describe('POST /users/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('login invalido deve retornar 401', async () => {
    const error = new Error('Credenciais invalidas');
    error.status = 401;
    userService.loginUser.mockRejectedValue(error);

    const response = await request(app)
      .post('/users/login')
      .send({
        login: 'usuario.invalido',
        senha: 'senha-invalida'
      });

    expect(response.status).toBe(401);
    expect(userService.loginUser).toHaveBeenCalledWith({
      login: 'usuario.invalido',
      senha: 'senha-invalida'
    });
  });

  it('login valido deve retornar token', async () => {
    userService.loginUser.mockResolvedValue({
      token: 'token-jwt-fake',
      user: {
        id: 1,
        nome: 'Admin',
        role: 'admin',
        empresas: [
          { id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }
        ]
      }
    });

    const response = await request(app)
      .post('/users/login')
      .send({
        login: 'admin',
        senha: 'senha-valida'
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('token-jwt-fake');
    expect(response.body.user).toEqual({
      id: 1,
      nome: 'Admin',
      role: 'admin',
      empresas: [
        { id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR' }
      ]
    });
  });
});
