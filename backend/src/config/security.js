const env = require('./env');

function parseSaltRounds(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 4) {
    return 10;
  }

  return parsed;
}

module.exports = {
  jwtSecret: env.jwt.secret,
  jwtExpiresIn: env.jwt.expiresIn,
  bcryptSaltRounds: parseSaltRounds(env.security.bcryptSaltRounds),
  requestBodyLimit: env.security.requestBodyLimit,
  helmetOptions: {
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  },
  swaggerHelmetOptions: {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  },
  apiRateLimit: {
    windowMs: env.security.rateLimitWindowMs,
    max: env.security.rateLimitMax
  },
  loginRateLimit: {
    windowMs: env.security.loginRateLimitWindowMs,
    max: env.security.loginRateLimitMax
  }
};
