function getIpAddress(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  if (typeof req.get === 'function') {
    return req.get('user-agent') || null;
  }

  return req.headers?.['user-agent'] || null;
}

function getRequestContext(req) {
  return {
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    requestId: req.requestId || null
  };
}

module.exports = {
  getRequestContext
};
