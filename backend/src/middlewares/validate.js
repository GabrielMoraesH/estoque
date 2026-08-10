const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');

function getErrorDetails(error) {
  return error.errors || error.issues || [];
}

function createValidationError(error) {
  const appError = new AppError('Invalid request data', 400, ERROR_CODES.VALIDATION_ERROR);
  appError.details = getErrorDetails(error);
  return appError;
}

function isZodSchema(schema) {
  return schema && typeof schema.safeParse === 'function';
}

function assignRequestProperty(req, property, value) {
  Object.defineProperty(req, property, {
    value,
    configurable: true,
    enumerable: true,
    writable: true
  });
}

function validateSingleProperty(req, res, next, schema, property) {
  const result = schema.safeParse(req[property]);

  if (!result.success) {
    return next(createValidationError(result.error));
  }

  assignRequestProperty(req, property, result.data);
  return next();
}

function validateSchemaMap(req, res, next, schemas) {
  const parsedData = {};

  for (const property of ['params', 'query', 'body']) {
    if (!schemas[property]) {
      continue;
    }

    const result = schemas[property].safeParse(req[property]);

    if (!result.success) {
      return next(createValidationError(result.error));
    }

    parsedData[property] = result.data;
  }

  for (const [property, value] of Object.entries(parsedData)) {
    assignRequestProperty(req, property, value);
  }

  return next();
}

function validate(schema, property = 'body') {
  return (req, res, next) => {
    if (isZodSchema(schema)) {
      return validateSingleProperty(req, res, next, schema, property);
    }

    return validateSchemaMap(req, res, next, schema);
  };
}

module.exports = validate;
module.exports.createValidationError = createValidationError;
