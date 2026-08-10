const jwt = require('jsonwebtoken');
const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');
const { jwtSecret } = require('../../config/security');

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

function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new AppError('Token nao fornecido', 401, ERROR_CODES.AUTHENTICATION_ERROR));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = {
      id: Number(decoded.id),
      role: decoded.role
    };

    return next();
  } catch (error) {
    return next(new AppError('Token invalido', 401, ERROR_CODES.AUTHENTICATION_ERROR));
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
