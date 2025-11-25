const { pool } = require('../config/database');

(async () => {
  try {
    const [rows] = await pool.query("SELECT symbol FROM symbols WHERE symbol LIKE '%TATA%' ORDER BY symbol LIMIT 200");
    console.log(rows.map(r => r.symbol).join('\n'));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
})();
