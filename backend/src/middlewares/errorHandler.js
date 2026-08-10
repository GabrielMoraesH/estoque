const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');
const logger = require('../utils/logger');
const env = require('../config/env');

const POSTGRES_ERROR_MAP = {
  '23505': { statusCode: 409, errorCode: ERROR_CODES.CONFLICT, message: 'Registro duplicado' },
  '23503': { statusCode: 400, errorCode: ERROR_CODES.DATABASE_ERROR, message: 'Registro possui vinculos e nao pode ser alterado' },
  '22P02': { statusCode: 400, errorCode: ERROR_CODES.VALIDATION_ERROR, message: 'Parametro invalido' },
  '42703': { statusCode: 500, errorCode: ERROR_CODES.DATABASE_ERROR, message: 'Erro interno do servidor' },
  '42P01': { statusCode: 500, errorCode: ERROR_CODES.DATABASE_ERROR, message: 'Erro interno do servidor' }
};

function isProduction() {
  return env.nodeEnv === 'production';
}

function getDefaultErrorCode(statusCode) {
  if (statusCode === 400) return ERROR_CODES.VALIDATION_ERROR;
  if (statusCode === 401) return ERROR_CODES.AUTHENTICATION_ERROR;
  if (statusCode === 403) return ERROR_CODES.AUTHORIZATION_ERROR;
  if (statusCode === 404) return ERROR_CODES.NOT_FOUND;
  if (statusCode === 409) return ERROR_CODES.CONFLICT;
  if (statusCode >= 500) return ERROR_CODES.INTERNAL_ERROR;
  return 'APP_ERROR';
}

function normalizePostgresError(err) {
  if (!err?.code || !POSTGRES_ERROR_MAP[err.code]) {
    return null;
  }

  const mapped = POSTGRES_ERROR_MAP[err.code];
  return new AppError(mapped.message, mapped.statusCode, mapped.errorCode);
}

function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }

  const databaseError = normalizePostgresError(err);

  if (databaseError) {
    return databaseError;
  }

  if (err.status || err.statusCode) {
    const statusCode = err.statusCode || err.status;
    return new AppError(
      err.message || 'Erro na requisicao',
      statusCode,
      err.errorCode || err.code || getDefaultErrorCode(statusCode)
    );
  }

  return new AppError('Erro interno do servidor', 500, ERROR_CODES.INTERNAL_ERROR);
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const normalizedError = normalizeError(err);
  const statusCode = normalizedError.statusCode;
  const shouldLog = statusCode >= 500 || !normalizedError.isOperational;

  if (shouldLog) {
    logger.error(
      `[error] ${req.method} ${req.originalUrl.split('?')[0]} ${statusCode}`,
      err.stack || err.message
    );
  }

  const response = {
    error: {
      message: normalizedError.message,
      code: normalizedError.errorCode || getDefaultErrorCode(statusCode),
      status: statusCode
    }
  };

  if (normalizedError.details) {
    response.error.details = normalizedError.details;
  }

  if (!isProduction() && err.stack) {
    response.error.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
module.exports.normalizeError = normalizeError;
