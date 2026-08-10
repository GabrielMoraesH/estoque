const AppError = require('./AppError');

function createHttpError(status, message, errorCode) {
  return new AppError(message, status, errorCode);
}

module.exports = createHttpError;
