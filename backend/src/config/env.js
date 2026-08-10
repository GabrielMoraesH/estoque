const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true
});

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value.trim();
}

function parsePort(value, fallback, name) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variavel de ambiente invalida para ${name}: ${value}`);
  }

  return parsed;
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variavel de ambiente invalida para ${name}: ${value}`);
  }

  return parsed;
}

function parseNodeEnv(value) {
  const normalized = value.trim();
  const allowedValues = ['development', 'production', 'test'];

  if (!allowedValues.includes(normalized)) {
    throw new Error(
      `Variavel de ambiente invalida para NODE_ENV: ${normalized}. Use development, production ou test`
    );
  }

  return normalized;
}

const env = {
  nodeEnv: parseNodeEnv(getRequiredEnv('NODE_ENV')),
  port: parsePort(getRequiredEnv('PORT'), 3000, 'PORT'),
  db: {
    host: getRequiredEnv('DB_HOST'),
    port: parsePort(getRequiredEnv('DB_PORT'), 5432, 'DB_PORT'),
    name: getRequiredEnv('DB_NAME'),
    user: getRequiredEnv('DB_USER'),
    password: getRequiredEnv('DB_PASSWORD')
  },
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN?.trim() || '1d'
  },
  security: {
    bcryptSaltRounds: process.env.BCRYPT_SALT_ROUNDS?.trim() || '10',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT?.trim() || '100kb',
    rateLimitWindowMs: parsePositiveInteger(
      process.env.RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
      'RATE_LIMIT_WINDOW_MS'
    ),
    rateLimitMax: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 300, 'RATE_LIMIT_MAX'),
    loginRateLimitWindowMs: parsePositiveInteger(
      process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
      'LOGIN_RATE_LIMIT_WINDOW_MS'
    ),
    loginRateLimitMax: parsePositiveInteger(
      process.env.LOGIN_RATE_LIMIT_MAX,
      10,
      'LOGIN_RATE_LIMIT_MAX'
    )
  }
};

module.exports = env;
