const axios = require('axios');
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Download and import Angel One instrument master data
 */
async function downloadAndImportInstruments() {
  console.log('📥 Downloading Angel One instrument master...');
  
  try {
    // Download the instruments JSON
    const response = await axios.get('https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json', {
      timeout: 30000
    });
    
    const instruments = response.data;
    console.log(`✅ Downloaded ${instruments.length} instruments`);
    
    // Clear existing symbols (optional - comment out if you want to keep existing data)
    // await pool.query('TRUNCATE TABLE symbols');
    
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    // Batch insert for better performance
    const batchSize = 100;
    
    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize);
      
      for (const instrument of batch) {
        try {
          // Map Angel One fields to our schema
          const symbol = instrument.symbol;
          const name = instrument.name;
          const token = instrument.token;
          const exchange = instrument.exch_seg; // NSE, BSE, NFO, BFO, etc.
          const instrumentType = instrument.instrumenttype; // EQ, CE, PE, FUTIDX, etc.
          const lotSize = instrument.lotsize || 1;
          
          // Parse expiry date (format: 28NOV2024)
          let expiryDate = null;
          if (instrument.expiry && instrument.expiry !== '') {
            try {
              const expiry = instrument.expiry;
              const day = expiry.substring(0, 2);
              const month = expiry.substring(2, 5);
              const year = expiry.substring(5, 9);
              
              const monthMap = {
                'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
                'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
                'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
              };
              
              expiryDate = `${year}-${monthMap[month]}-${day}`;
            } catch (e) {
              // Invalid date format, skip
            }
          }
          
          const strikePrice = instrument.strike ? parseFloat(instrument.strike) / 100 : null;
          const optionType = instrument.instrumenttype === 'OPTIDX' || instrument.instrumenttype === 'OPTSTK' 
            ? (instrument.symbol.includes('CE') ? 'CE' : instrument.symbol.includes('PE') ? 'PE' : null)
            : null;
          
          // Determine segment
          let segment = 'EQ';
          if (exchange === 'NFO' || exchange === 'BFO') {
            if (instrumentType.includes('OPT')) segment = 'OPTIDX';
            else if (instrumentType.includes('FUT')) segment = 'FUTIDX';
          } else if (instrumentType === 'INDEX') {
            segment = 'INDICES';
          }
          
          // Insert or update symbol
          const query = `
            INSERT INTO symbols (
              symbol, name, token, exchange, segment, 
              instrument_type, lot_size, strike_price, 
              expiry_date, option_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              lot_size = VALUES(lot_size),
              strike_price = VALUES(strike_price),
              expiry_date = VALUES(expiry_date),
              option_type = VALUES(option_type)
          `;
          
          await pool.query(query, [
            symbol,
            name,
            token,
            exchange,
            segment,
            instrumentType,
            lotSize,
            strikePrice,
            expiryDate,
            optionType
          ]);
          
          inserted++;
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            skipped++;
          } else {
            errors++;
            console.error(`Error inserting ${instrument.symbol}:`, error.message);
          }
        }
      }
      
      // Progress indicator
      if (i % 1000 === 0) {
        console.log(`📊 Processed ${i}/${instruments.length} instruments...`);
      }
    }
    
    console.log('\n✅ Import completed!');
    console.log(`📈 Inserted: ${inserted}`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Show summary by exchange
    const [summary] = await pool.query(`
      SELECT exchange, segment, COUNT(*) as count 
      FROM symbols 
      GROUP BY exchange, segment 
      ORDER BY exchange, segment
    `);
    
    console.log('\n📊 Symbols by Exchange & Segment:');
    console.table(summary);
    
    return true;
  } catch (error) {
    console.error('❌ Error downloading instruments:', error.message);
    return false;
  }
}

/**
 * Run the import
 */
if (require.main === module) {
  console.log('🚀 Starting Angel One instrument import...\n');
  
  downloadAndImportInstruments()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = { downloadAndImportInstruments };
