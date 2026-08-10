const { createUserService } = require('../modules/users/user.service');
const { createInMemoryUserRepository } = require('../modules/users/in-memory-user.repository');

const passwordHasher = {
  async hash(value) {
    return `hashed:${value}`;
  },

  async compare(value, hashedValue) {
    return hashedValue === `hashed:${value}`;
  }
};

const tokenProvider = {
  sign(payload) {
    return `token:${payload.id}:${payload.role}`;
  }
};

const audit = {
  logAction: jest.fn()
};

describe('UserService com IUserRepository em memoria', () => {
  beforeEach(() => {
    audit.logAction.mockClear();
  });

  it('permite trocar PostgreSQL por repository em memoria sem mudar o service', async () => {
    const repository = createInMemoryUserRepository();
    const service = createUserService({
      repository,
      audit,
      passwordHasher,
      tokenProvider,
      security: {
        bcryptSaltRounds: 1,
        jwtSecret: 'test-secret',
        jwtExpiresIn: '1h'
      }
    });

    await service.registerUser({
      nome: 'Admin',
      login: 'admin',
      senha: '123456',
      role: 'admin',
      empresa_ids: [1],
      actor: { id: 1, role: 'admin' }
    });

    const result = await service.loginUser({
      login: 'admin',
      senha: '123456'
    });

    expect(result).toEqual({
      token: 'token:1:admin',
      user: {
        id: 1,
        nome: 'Admin',
        role: 'admin',
        empresas: [
          {
            id: 1,
            codigo: 'DIMEBRAS_PR',
            nome: 'Dimebras PR'
          }
        ]
      }
    });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.created',
      entityType: 'user'
    }));
  });
});
