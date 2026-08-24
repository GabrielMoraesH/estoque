const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const finishedAt = process.hrtime.bigint();
    const durationMs = Number(finishedAt - startedAt) / 1_000_000;
    const path = req.originalUrl.split('?')[0];

    logger.info(
      `[request] [request_id=${req.requestId}] ${req.method} ${path} ${res.statusCode} ${Math.round(durationMs)}ms`
    );
  });

  next();
}

module.exports = requestLogger;
