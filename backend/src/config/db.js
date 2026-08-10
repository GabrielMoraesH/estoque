const { Pool, types } = require('pg');
const env = require('./env');

types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password
});

module.exports = pool;
