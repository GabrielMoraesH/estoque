const rateLimit = require('express-rate-limit');
const {
  apiRateLimit,
  loginRateLimit
} = require('../config/security');

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false
};

const apiLimiter = rateLimit({
  ...standardOptions,
  windowMs: apiRateLimit.windowMs,
  limit: apiRateLimit.max,
  message: {
    error: 'Muitas requisicoes. Tente novamente em instantes.'
  }
});

const loginLimiter = rateLimit({
  ...standardOptions,
  windowMs: loginRateLimit.windowMs,
  limit: loginRateLimit.max,
  skipSuccessfulRequests: true,
  message: {
    error: 'Muitas tentativas de login. Tente novamente em instantes.'
  }
});

module.exports = {
  apiLimiter,
  loginLimiter
};
