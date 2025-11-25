const db = require('./config/database');

async function test() {
  try {
    console.log('Testing database queries...\n');
    
    // Test 1: Check indices
    const [indices] = await db.pool.query(`
      SELECT symbol, segment, instrument_type, token, exchange 
      FROM symbols 
      WHERE segment = 'Index' AND exchange = 'NSE'
      LIMIT 10
    `);
    console.log('Indices found:', indices.length);
    console.log(JSON.stringify(indices, null, 2));
    
    // Test 2: Check popular stocks
    const [stocks] = await db.pool.query(`
      SELECT symbol, segment, instrument_type, token, exchange 
      FROM symbols 
      WHERE exchange = 'NSE' 
        AND segment IN ('EQ', 'Equity')
        AND symbol IN ('RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK')
      LIMIT 10
    `);
    console.log('\nPopular stocks found:', stocks.length);
    console.log(JSON.stringify(stocks, null, 2));
    
    // Test 3: Check search
    const [search] = await db.pool.query(`
      SELECT symbol, name, segment, instrument_type, token, exchange 
      FROM symbols 
      WHERE UPPER(symbol) LIKE '%RELIANCE%' OR UPPER(name) LIKE '%RELIANCE%'
      LIMIT 5
    `);
    console.log('\nSearch results for RELIANCE:', search.length);
    console.log(JSON.stringify(search, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

test();
