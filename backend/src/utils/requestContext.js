function getIpAddress(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];

  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }

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
    userAgent: getUserAgent(req)
  };
}

module.exports = {
  getRequestContext
};
