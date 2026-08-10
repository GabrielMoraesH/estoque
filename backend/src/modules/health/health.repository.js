const pool = require('../../config/db');

function createHealthRepository(db = pool) {
  return {
    async pingDatabase() {
      await db.query('SELECT 1');
    }
  };
}

module.exports = createHealthRepository();
module.exports.createHealthRepository = createHealthRepository;
