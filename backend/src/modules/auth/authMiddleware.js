const jwt = require('jsonwebtoken');
const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const { jwtAlgorithm, jwtSecret } = require('../../config/security');
const authRepository = require('./authRepository');

function extractBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new AppError('Token nao fornecido', 401, ERROR_CODES.AUTHENTICATION_ERROR));
  }

  let decoded;

  try {
    decoded = jwt.verify(token, jwtSecret, { algorithms: [jwtAlgorithm] });
  } catch (error) {
    return next(new AppError('Token invalido', 401, ERROR_CODES.AUTHENTICATION_ERROR));
  }

  const userId = Number(decoded.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError('Token invalido', 401, ERROR_CODES.AUTHENTICATION_ERROR));
  }

  try {
    const user = await authRepository.findCurrentUserById(userId);

    if (!user || user.ativo === false) {
      return next(new AppError('Sessao invalida', 401, ERROR_CODES.AUTHENTICATION_ERROR));
    }

    req.user = {
      id: Number(user.id),
      nome: user.nome,
      role: user.role,
      nivel_estoquista: user.nivel_estoquista ?? null,
      empresas: Array.isArray(user.empresas) ? user.empresas : []
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Usuario nao autenticado', 401, ERROR_CODES.AUTHENTICATION_ERROR));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Voce nao tem permissao para acessar este recurso', 403, ERROR_CODES.AUTHORIZATION_ERROR));
    }

    return next();
  };
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;
