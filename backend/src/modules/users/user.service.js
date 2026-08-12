const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const { assertUserRepository } = require('./IUserRepository');
const {
  bcryptSaltRounds,
  jwtSecret,
  jwtExpiresIn
} = require('../../config/security');

const noopAudit = {
  async logAction() {}
};

function badRequest(message) {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
}

function notFound(message) {
  return new AppError(message, 404, ERROR_CODES.NOT_FOUND);
}

function normalizeNivelEstoquista(role, nivelEstoquista) {
  if (role !== 'estoquista') {
    return null;
  }

  const normalizedLevel = Number(nivelEstoquista);

  if (![1, 2, 3].includes(normalizedLevel)) {
    throw badRequest('Informe o nivel do estoquista');
  }

  return normalizedLevel;
}

function assertPasswordMinLength(senha) {
  if (typeof senha !== 'string' || senha.length < 6) {
    throw badRequest('Senha deve possuir no minimo 6 caracteres');
  }
}

function normalizeEstoquistaNivelFilter(nivel) {
  if (nivel === undefined || nivel === null || nivel === '') {
    return undefined;
  }

  const normalizedLevel = Number(nivel);

  if (![1, 2, 3].includes(normalizedLevel)) {
    throw badRequest('Nivel do estoquista invalido');
  }

  return normalizedLevel;
}

function normalizeEmpresaIds(empresaIds, { required = false } = {}) {
  if (empresaIds === undefined) {
    if (required) {
      throw badRequest('Informe ao menos uma empresa de acesso');
    }

    return undefined;
  }

  if (!Array.isArray(empresaIds) || empresaIds.length === 0) {
    throw badRequest('Informe ao menos uma empresa de acesso');
  }

  const normalizedIds = empresaIds.map((empresaId) => Number(empresaId));
  const hasInvalidId = normalizedIds.some((empresaId) => (
    !Number.isInteger(empresaId) || empresaId <= 0
  ));

  if (hasInvalidId) {
    throw badRequest('Empresas de acesso invalidas');
  }

  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw badRequest('Empresas de acesso nao podem ser duplicadas');
  }

  return normalizedIds;
}

async function assertActiveEmpresas(repository, empresaIds) {
  const activeEmpresaIds = await repository.findActiveEmpresaIds(empresaIds);

  if (activeEmpresaIds.length !== empresaIds.length) {
    throw badRequest('Uma ou mais empresas informadas nao existem ou estao inativas');
  }
}

function createUserService({
  repository,
  audit = noopAudit,
  passwordHasher = bcrypt,
  tokenProvider = jwt,
  security = { bcryptSaltRounds, jwtSecret, jwtExpiresIn }
} = {}) {
  assertUserRepository(repository);

  async function registerUser({
    nome,
    login,
    senha,
    role,
    nivel_estoquista,
    empresa_ids,
    actor,
    auditContext
  }) {
    try {
      assertPasswordMinLength(senha);
      const empresaIds = normalizeEmpresaIds(empresa_ids, { required: true });
      const nivelEstoquista = normalizeNivelEstoquista(role, nivel_estoquista);
      const hashedPassword = await passwordHasher.hash(senha, security.bcryptSaltRounds);

      const user = await repository.withTransaction(async (transactionRepository) => {
        await assertActiveEmpresas(transactionRepository, empresaIds);

        const createdUser = await transactionRepository.create({
          nome,
          login,
          senha: hashedPassword,
          role,
          nivel_estoquista: nivelEstoquista
        });

        await transactionRepository.replaceUserEmpresas(createdUser.id, empresaIds);
        return transactionRepository.findSummaryById(createdUser.id);
      });

      await audit.logAction({
        user: actor,
        action: 'user.created',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          created_user: user,
          empresa_ids: empresaIds
        },
        auditContext
      });

      return user;
    } catch (err) {
      if (err.code === '23505') {
        throw new AppError('Login ja existe', 409, ERROR_CODES.CONFLICT);
      }

      throw err;
    }
  }

  async function loginUser({ login, senha }) {
    const user = await repository.findByLogin(login);

    if (!user) {
      throw badRequest('Usuario nao encontrado');
    }

    if (user.ativo === false) {
      throw new AppError(
        'Usuário desativado. Entre em contato com o administrador.',
        403,
        ERROR_CODES.AUTHORIZATION_ERROR
      );
    }

    const senhaValida = await passwordHasher.compare(senha, user.senha);

    if (!senhaValida) {
      throw badRequest('Senha invalida');
    }

    const empresas = await repository.listActiveEmpresasByUserId(user.id);

    if (empresas.length === 0) {
      throw new AppError(
        'Usuario sem empresa vinculada',
        403,
        ERROR_CODES.AUTHORIZATION_ERROR
      );
    }

    const token = tokenProvider.sign(
      { id: user.id, role: user.role },
      security.jwtSecret,
      { expiresIn: security.jwtExpiresIn }
    );

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        role: user.role,
        empresas
      }
    };
  }

  async function listUsers() {
    return repository.list();
  }

  async function updateUser({
    id,
    nome,
    login,
    role,
    nivel_estoquista,
    senha,
    empresa_ids,
    actor,
    auditContext
  }) {
    try {
      const empresaIds = normalizeEmpresaIds(empresa_ids, { required: false });
      const currentUser = await repository.findSummaryById(id);

      if (!currentUser) {
        throw notFound('Usuario nao encontrado');
      }

      const passwordChanged = Boolean(senha && senha.trim());
      if (passwordChanged) {
        assertPasswordMinLength(senha);
      }

      const hashedPassword = passwordChanged
        ? await passwordHasher.hash(senha, security.bcryptSaltRounds)
        : null;
      const nivelEstoquista = normalizeNivelEstoquista(role, nivel_estoquista);

      const updatedUser = await repository.withTransaction(async (transactionRepository) => {
        if (empresaIds) {
          await assertActiveEmpresas(transactionRepository, empresaIds);
        }

        const savedUser = await transactionRepository.update({
          id,
          nome,
          login,
          role,
          nivel_estoquista: nivelEstoquista,
          senha: hashedPassword
        });

        if (!savedUser) {
          throw notFound('Usuario nao encontrado');
        }

        if (empresaIds) {
          await transactionRepository.replaceUserEmpresas(id, empresaIds);
        }

        return transactionRepository.findSummaryById(id);
      });

      const metadata = {
        previous_user: currentUser,
        updated_user: updatedUser,
        password_changed: passwordChanged
      };

      if (empresaIds) {
        metadata.empresa_ids = empresaIds;
      }

      await audit.logAction({
        user: actor,
        action: 'user.updated',
        entityType: 'user',
        entityId: updatedUser.id,
        metadata,
        auditContext
      });

      return updatedUser;
    } catch (err) {
      if (err.code === '23505') {
        throw new AppError('Login ja existe', 409, ERROR_CODES.CONFLICT);
      }

      throw err;
    }
  }

  async function updateUserStatus({
    id,
    ativo,
    actor,
    auditContext
  }) {
    if (Number(id) === Number(actor?.id) && ativo === false) {
      throw badRequest('Voce nao pode desativar seu proprio usuario');
    }

    const currentUser = await repository.findSummaryById(id);

    if (!currentUser) {
      throw notFound('Usuario nao encontrado');
    }

    const updatedUser = await repository.withTransaction(async (transactionRepository) => {
      const savedUser = await transactionRepository.updateStatus({ id, ativo });

      if (!savedUser) {
        throw notFound('Usuario nao encontrado');
      }

      return transactionRepository.findSummaryById(id);
    });

    await audit.logAction({
      user: actor,
      action: ativo ? 'user.reactivated' : 'user.deactivated',
      entityType: 'user',
      entityId: updatedUser.id,
      metadata: {
        target_user_id: updatedUser.id,
        target_login: updatedUser.login
      },
      auditContext
    });

    return updatedUser;
  }

  async function deleteUser({ id, loggedUserId, actor, auditContext }) {
    if (Number(id) === loggedUserId) {
      throw badRequest('Voce nao pode excluir seu proprio usuario');
    }

    try {
      const deletedUser = await repository.deleteById(id);

      if (!deletedUser) {
        throw notFound('Usuario nao encontrado');
      }

      await audit.logAction({
        user: actor,
        action: 'user.deleted',
        entityType: 'user',
        entityId: deletedUser.id,
        metadata: {
          deleted_user: deletedUser
        },
        auditContext
      });

      return { message: 'Usuario excluido com sucesso' };
    } catch (err) {
      if (err.code === '23503') {
        throw badRequest('Nao foi possivel excluir este usuario porque ele possui registros vinculados');
      }

      throw err;
    }
  }

  async function listEstoquistas({ empresaId, nivel } = {}) {
    return repository.listEstoquistas({
      empresaId,
      nivel: normalizeEstoquistaNivelFilter(nivel)
    });
  }

  return {
    registerUser,
    loginUser,
    listUsers,
    updateUser,
    updateUserStatus,
    deleteUser,
    listEstoquistas
  };
}

module.exports = {
  createUserService
};
