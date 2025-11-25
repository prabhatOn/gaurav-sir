const db = require('./config/database');

async function test() {
  try {
    // Check for NIFTY options
    const [niftyOptions] = await db.pool.query(
      "SELECT DISTINCT symbol, token, exchange, segment, option_type, expiry_date, strike_price FROM symbols WHERE symbol LIKE 'NIFTY%' AND option_type IS NOT NULL ORDER BY expiry_date, strike_price LIMIT 20"
    );
    console.log('\nNIFTY options found:', niftyOptions.length);
    if (niftyOptions.length > 0) {
      console.log(JSON.stringify(niftyOptions, null, 2));
    }
    
    // Check for BANKNIFTY options
    const [bankniftyOptions] = await db.pool.query(
      "SELECT DISTINCT symbol, token, exchange, segment, option_type, expiry_date, strike_price FROM symbols WHERE symbol LIKE 'BANKNIFTY%' AND option_type IS NOT NULL ORDER BY expiry_date, strike_price LIMIT 20"
    );
    console.log('\nBANKNIFTY options found:', bankniftyOptions.length);
    if (bankniftyOptions.length > 0) {
      console.log(JSON.stringify(bankniftyOptions, null, 2));
    }
    
    // Check available segments with options
    const [segments] = await db.pool.query(
      "SELECT segment, COUNT(*) as cnt FROM symbols WHERE option_type IS NOT NULL GROUP BY segment ORDER BY cnt DESC"
    );
    console.log('\nOption segments:', segments);
    
    // Check some available expiry dates
    const [expiries] = await db.pool.query(
      "SELECT DISTINCT expiry_date FROM symbols WHERE option_type IS NOT NULL AND expiry_date IS NOT NULL ORDER BY expiry_date LIMIT 10"
    );
    console.log('\nAvailable expiries:', expiries);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

test();
