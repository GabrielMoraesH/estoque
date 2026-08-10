function formatMessage(level, args) {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}]`, `[${level}]`, ...args];
}

const logger = {
  info: (...args) => {
    console.log(...formatMessage('info', args));
  },
  warn: (...args) => {
    console.warn(...formatMessage('warn', args));
  },
  error: (...args) => {
    console.error(...formatMessage('error', args));
  }
};

module.exports = logger;
