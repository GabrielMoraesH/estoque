const jwt = require('jsonwebtoken');
const createHttpError = require('../utils/createHttpError');
const { jwtSecret } = require('../config/security');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(createHttpError(401, 'Token não fornecido'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return next(createHttpError(401, 'Token inválido'));
  }
}

module.exports = authMiddleware;
