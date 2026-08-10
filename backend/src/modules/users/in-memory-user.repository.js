const { assertUserRepository } = require('./IUserRepository');

function cloneUser(user) {
  return user ? { ...user } : null;
}

function createPgDuplicateError() {
  const error = new Error('Duplicate user login');
  error.code = '23505';
  return error;
}

function createInMemoryUserRepository({ users = [] } = {}) {
  let nextId = users.reduce((maxId, user) => Math.max(maxId, Number(user.id || 0)), 0) + 1;
  const state = users.map((user) => ({
    ...user,
    ativo: user.ativo !== false,
    empresas: Array.isArray(user.empresas) ? user.empresas.map((empresa) => ({ ...empresa })) : []
  }));
  const empresas = [
    { id: 1, codigo: 'DIMEBRAS_PR', nome: 'Dimebras PR', ativo: true },
    { id: 2, codigo: 'DIMEBRAS_SC', nome: 'Dimebras SC', ativo: true },
    { id: 3, codigo: 'DIMEBRAS_MT', nome: 'Dimebras MT', ativo: true },
    { id: 4, codigo: 'DIMEBRAS_MS', nome: 'Dimebras MS', ativo: true },
    { id: 5, codigo: 'ALFAMED_MS', nome: 'Alfamed MS', ativo: true }
  ];

  function publicUserFrom(user) {
    const { senha: _senha, ...publicUser } = user;
    return {
      ...publicUser,
      empresas: Array.isArray(user.empresas) ? user.empresas.map((empresa) => ({ ...empresa })) : []
    };
  }

  const repository = {
    async withTransaction(callback) {
      return callback(repository);
    },

    async create({ nome, login, senha, role, nivel_estoquista }) {
      if (state.some((user) => user.login === login)) {
        throw createPgDuplicateError();
      }

      const user = {
        id: nextId++,
        nome,
        login,
        senha,
        role,
        nivel_estoquista,
        ativo: true,
        created_at: new Date().toISOString(),
        empresas: []
      };
      state.push(user);

      return publicUserFrom(user);
    },

    async findByLogin(login) {
      return cloneUser(state.find((user) => user.login === login));
    },

    async findSummaryById(id) {
      const user = state.find((item) => Number(item.id) === Number(id));

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        nome: user.nome,
        login: user.login,
        role: user.role,
        nivel_estoquista: user.nivel_estoquista ?? null,
        ativo: user.ativo !== false,
        created_at: user.created_at,
        empresas: user.empresas.map((empresa) => ({ ...empresa }))
      };
    },

    async findActiveEmpresaIds(empresaIds) {
      return empresas
        .filter((empresa) => empresa.ativo && empresaIds.includes(empresa.id))
        .map((empresa) => empresa.id)
        .sort((a, b) => a - b);
    },

    async listActiveEmpresasByUserId(userId) {
      const user = state.find((item) => Number(item.id) === Number(userId));

      if (!user) {
        return [];
      }

      return user.empresas
        .filter((empresa) => empresas.some((item) => item.id === empresa.id && item.ativo))
        .map((empresa) => ({ id: empresa.id, codigo: empresa.codigo, nome: empresa.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },

    async replaceUserEmpresas(userId, empresaIds) {
      const user = state.find((item) => Number(item.id) === Number(userId));

      if (!user) {
        return;
      }

      user.empresas = empresas
        .filter((empresa) => empresaIds.includes(empresa.id))
        .map(({ ativo: _ativo, ...empresa }) => empresa);
    },

    async list() {
      return state
        .map(publicUserFrom)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },

    async update({ id, nome, login, role, nivel_estoquista, senha }) {
      const user = state.find((item) => Number(item.id) === Number(id));

      if (!user) {
        return null;
      }

      if (state.some((item) => item.login === login && Number(item.id) !== Number(id))) {
        throw createPgDuplicateError();
      }

      user.nome = nome;
      user.login = login;
      user.role = role;
      user.nivel_estoquista = nivel_estoquista ?? null;

      if (senha) {
        user.senha = senha;
      }

      return publicUserFrom(user);
    },

    async updateStatus({ id, ativo }) {
      const user = state.find((item) => Number(item.id) === Number(id));

      if (!user) {
        return null;
      }

      user.ativo = ativo;
      return publicUserFrom(user);
    },

    async deleteById(id) {
      const index = state.findIndex((user) => Number(user.id) === Number(id));

      if (index < 0) {
        return null;
      }

      const [deletedUser] = state.splice(index, 1);
      return publicUserFrom(deletedUser);
    },

    async listEstoquistas({ empresaId } = {}) {
      return state
        .filter((user) => user.role === 'estoquista')
        .filter((user) => (
          !empresaId || user.empresas.some((empresa) => Number(empresa.id) === Number(empresaId))
        ))
        .map((user) => ({
          id: user.id,
          nome: user.nome,
          nivel_estoquista: user.nivel_estoquista ?? null,
          empresas: user.empresas.map((empresa) => ({ ...empresa }))
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }
  };

  assertUserRepository(repository);
  return repository;
}

module.exports = createInMemoryUserRepository;
module.exports.createInMemoryUserRepository = createInMemoryUserRepository;
