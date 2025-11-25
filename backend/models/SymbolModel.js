const { pool } = require('../config/database');

class SymbolModel {
  /**
   * Get all unique exchanges
   */
  static async getExchanges() {
    const [rows] = await pool.query(
      'SELECT DISTINCT exchange FROM symbols ORDER BY exchange'
    );
    return rows.map(row => row.exchange);
  }

  /**
   * Get segments by exchange
   */
  static async getSegmentsByExchange(exchange) {
    const [rows] = await pool.query(
      'SELECT DISTINCT segment FROM symbols WHERE exchange = ? ORDER BY segment',
      [exchange]
    );
    return rows.map(row => row.segment);
  }

  /**
   * Get symbols filtered by exchange and segment
   */
  static async getSymbols(exchange, segment) {
    const [rows] = await pool.query(
      `SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        strike_price,
        expiry_date,
        option_type
      FROM symbols 
      WHERE exchange = ? AND segment = ?
      ORDER BY symbol`,
      [exchange, segment]
    );
    return rows;
  }

  /**
   * Get symbol token by symbol name and exchange
   */
  static async getSymbolToken(symbol, exchange) {
    const [rows] = await pool.query(
      'SELECT token, exchange, segment, lot_size FROM symbols WHERE symbol = ? AND exchange = ? LIMIT 1',
      [symbol, exchange]
    );
    return rows[0] || null;
  }

  /**
   * Get symbol details by token
   */
  static async getSymbolByToken(token, exchange) {
    const [rows] = await pool.query(
      `SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        strike_price,
        expiry_date,
        option_type
      FROM symbols 
      WHERE token = ? AND exchange = ?
      LIMIT 1`,
      [token, exchange]
    );
    return rows[0] || null;
  }

  /**
   * Get symbol by exact match (tries multiple patterns)
   */
  static async getSymbolByExactMatch(symbol) {
    // Try exact match first (case-insensitive for indices like "Nifty 50")
    let [rows] = await pool.query(
      `SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        lot_size
      FROM symbols 
      WHERE symbol = ? OR LOWER(symbol) = LOWER(?)
      LIMIT 1`,
      [symbol, symbol]
    );
    
    if (rows && rows.length > 0) return rows[0];
    
    // Try with -EQ suffix for NSE stocks (e.g., RELIANCE -> RELIANCE-EQ)
    [rows] = await pool.query(
      `SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        lot_size
      FROM symbols 
      WHERE symbol = ? AND exchange = 'NSE'
      LIMIT 1`,
      [`${symbol}-EQ`]
    );
    
    if (rows && rows.length > 0) return rows[0];
    
    // Try name match for indices (e.g., searching by name like "Nifty 50")
    [rows] = await pool.query(
      `SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        lot_size
      FROM symbols 
      WHERE name = ? OR LOWER(name) = LOWER(?)
      LIMIT 1`,
      [symbol, symbol]
    );
    
    return rows && rows.length > 0 ? rows[0] : null;
  }

  /**
   * Search symbols by partial name match
   * Returns stocks and indices first, then options/futures
   */
  static async searchSymbols(searchTerm) {
    const term = (searchTerm ?? '').toString().trim();
    if (!term) return [];

    const likeTerm = `%${term.toUpperCase()}%`;
    const exactTerm = term.toUpperCase();
    const startTerm = `${term.toUpperCase()}%`;
    
    const query = `
      SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        lot_size
      FROM symbols 
      WHERE (UPPER(symbol) LIKE ? OR UPPER(name) LIKE ?)
      ORDER BY 
        CASE 
          WHEN segment IN ('Index', 'INDICES') THEN 1
          WHEN exchange IN ('NSE', 'BSE') AND segment IN ('EQ', 'Equity') THEN 2
          ELSE 3
        END,
        CASE
          WHEN UPPER(symbol) = ? THEN 1
          WHEN UPPER(symbol) LIKE ? THEN 2
          ELSE 3
        END,
        symbol
      LIMIT 50
    `;
    
    console.log('[SymbolModel] searchSymbols for:', term);
    const [rows] = await pool.query(query, [likeTerm, likeTerm, exactTerm, startTerm]);
    console.log('[SymbolModel] searchSymbols found:', rows.length, 'results');
    return rows;
  }

  /**
   * Get option chain for a symbol
   */
  static async getOptionChain(underlyingSymbol, expiry = null) {
    // Normalize symbol name - "Nifty 50" -> "NIFTY", "Nifty Bank" -> "BANKNIFTY"
    let cleanSymbol = (underlyingSymbol || '').trim().toUpperCase();
    if (cleanSymbol === 'NIFTY 50' || cleanSymbol === 'NIFTY50') cleanSymbol = 'NIFTY';
    if (cleanSymbol === 'BANK NIFTY' || cleanSymbol === 'NIFTY BANK') cleanSymbol = 'BANKNIFTY';
    cleanSymbol = cleanSymbol.replace(/\s+\d+$/, '').replace('-EQ', '');
    
    console.log('[SymbolModel] getOptionChain - Original:', underlyingSymbol, '-> Cleaned:', cleanSymbol, 'expiry:', expiry);
    
    // Parse expiry date components for pattern matching
    let day = '', month = '', year = '', monthNum = '';
    if (expiry && typeof expiry === 'string' && expiry.match(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/)) {
      const parts = expiry.split('-');
      day = parts[0].padStart(2, '0');
      month = parts[1].toUpperCase();
      year = parts[2].slice(-2);
      const monthMap = { 'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
                         'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12' };
      monthNum = monthMap[month] || '01';
    }
    
    // Build more precise expiry patterns to avoid matching similar symbols
    // e.g., NIFTY should not match NIFTYNXT50
    // Pattern: Symbol + DD (2 digits) ensures we match only date-based suffixes
    const expiryPatterns = [];
    if (day && month && year) {
      // Format 1: DDMMMYY (e.g., NIFTY25NOV2524000CE) - Index options - exact symbol + date
      expiryPatterns.push(`${cleanSymbol}${day}${month}${year}%`);
      // Format 2: DDMMM (e.g., ITC25DEC400CE) - Stock options - exact symbol + date
      expiryPatterns.push(`${cleanSymbol}${day}${month}%`);
      // Format 3: YY + M + DD (e.g., SENSEX25D0475700CE) - BSE indices
      const monthCodes = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6',
                           '07': '7', '08': '8', '09': '9', '10': 'O', '11': 'N', '12': 'D' };
      const monthCode = monthCodes[monthNum] || 'N';
      expiryPatterns.push(`${cleanSymbol}${year}${monthCode}${day}%`);
    }
    
    let query, params;
    
    if (expiryPatterns.length > 0) {
      // Use symbol pattern matching for expiry
      query = `
        SELECT 
          symbol,
          name,
          exchange,
          segment,
          token,
          instrument_type,
          strike_price,
          expiry_date,
          option_type,
          lot_size
        FROM symbols 
        WHERE (symbol LIKE ? OR symbol LIKE ? OR symbol LIKE ?)
        AND (symbol LIKE '%CE' OR symbol LIKE '%PE')
        ORDER BY symbol
      `;
      params = expiryPatterns;
    } else {
      // No expiry provided - get options but ensure exact symbol prefix match
      // Pattern: SYMBOL + 2 digits (date) to avoid NIFTY matching NIFTYNXT50
      // Use REGEXP to match symbol followed by digits
      query = `
        SELECT 
          symbol,
          name,
          exchange,
          segment,
          token,
          instrument_type,
          strike_price,
          expiry_date,
          option_type,
          lot_size
        FROM symbols 
        WHERE symbol REGEXP ?
        AND (symbol LIKE '%CE' OR symbol LIKE '%PE')
        ORDER BY symbol
        LIMIT 500
      `;
      // Regex: ^NIFTY[0-9] means NIFTY followed by a digit
      params = [`^${cleanSymbol}[0-9]`];
    }

    console.log('[SymbolModel] getOptionChain query patterns:', params);
    const [rows] = await pool.query(query, params);
    console.log('[SymbolModel] getOptionChain found', rows.length, 'option contracts for', cleanSymbol);
    
    // Extract strike price and option type from symbol name since DB columns may be NULL
    // Patterns: NIFTY25NOV2524000CE, ITC25DEC400PE, SENSEX25D0475700CE
    const enrichedRows = rows.map(row => {
      const sym = row.symbol || '';
      
      // Determine option type from symbol suffix
      let optionType = row.option_type;
      if (!optionType) {
        if (sym.endsWith('CE')) optionType = 'CE';
        else if (sym.endsWith('PE')) optionType = 'PE';
      }
      
      // Extract strike price from symbol if not in DB
      let strikePrice = row.strike_price;
      if (!strikePrice || strikePrice === '0' || strikePrice === 0) {
        // Try different regex patterns to extract strike
        // Pattern 1: SYMBOL + DDMMMYY + STRIKE + CE/PE
        const regex1 = new RegExp(`^${cleanSymbol}\\d{2}[A-Z]{3}\\d{2}(\\d+(?:\\.\\d+)?)(CE|PE)$`, 'i');
        // Pattern 2: SYMBOL + DDMMM + STRIKE + CE/PE (stock options)
        const regex2 = new RegExp(`^${cleanSymbol}\\d{2}[A-Z]{3}(\\d+(?:\\.\\d+)?)(CE|PE)$`, 'i');
        // Pattern 3: SYMBOL + YY + M + DD + STRIKE + CE/PE (BSE)
        const regex3 = new RegExp(`^${cleanSymbol}\\d{2}[A-Z0-9]\\d{2}(\\d+)(CE|PE)$`, 'i');
        
        let match = sym.match(regex1) || sym.match(regex2) || sym.match(regex3);
        if (match) {
          strikePrice = parseFloat(match[1]);
        }
      }
      
      return {
        ...row,
        option_type: optionType,
        strike_price: strikePrice
      };
    });
    
    // Filter out rows without valid strike price
    return enrichedRows.filter(r => r.strike_price && r.option_type);
  }

  /**
   * Get available expiry dates for a symbol
   */
  static async getExpiries(underlyingSymbol) {
    // Clean up symbol name - remove extra text like "50", "BANK", etc.
    // NIFTY 50 -> NIFTY, BANKNIFTY -> BANKNIFTY, NIFTY -> NIFTY
    let cleanSymbol = underlyingSymbol.trim().toUpperCase();
    
    // Special case mappings - handle various formats
    if (cleanSymbol === 'NIFTY 50' || cleanSymbol === 'NIFTY50') cleanSymbol = 'NIFTY';
    if (cleanSymbol === 'BANK NIFTY' || cleanSymbol === 'NIFTY BANK') cleanSymbol = 'BANKNIFTY';
    if (cleanSymbol === 'FINNIFTY' || cleanSymbol === 'FIN NIFTY') cleanSymbol = 'FINNIFTY';
    
    // Remove common suffixes that might not match
    cleanSymbol = cleanSymbol.replace(/\s+\d+$/, ''); // Remove trailing numbers like " 50"
    cleanSymbol = cleanSymbol.replace('-EQ', ''); // Remove -EQ suffix
    
    console.log('[SymbolModel] getExpiries - Original:', underlyingSymbol, '-> Cleaned:', cleanSymbol);
    
    // Use REGEXP to ensure exact symbol prefix match (symbol followed by digit)
    // This prevents NIFTY from matching NIFTYNXT50
    const query = `
      SELECT DISTINCT expiry_date
      FROM symbols 
      WHERE symbol REGEXP ?
      AND expiry_date IS NOT NULL
      ORDER BY expiry_date
    `;
    const [rows] = await pool.query(query, [`^${cleanSymbol}[0-9]`]);
    console.log('[SymbolModel] Found', rows.length, 'expiry dates for', cleanSymbol);
    return rows.map(row => row.expiry_date);
  }

  /**
   * Get available strike prices for symbol and expiry
   * Parses strikes from symbol names since strike_price column may not be populated
   */
  static async getStrikes(underlyingSymbol, expiry) {
    // Normalize symbol name
    let cleanSymbol = (underlyingSymbol || '').trim().toUpperCase();
    if (cleanSymbol === 'NIFTY 50') cleanSymbol = 'NIFTY';
    if (cleanSymbol === 'BANK NIFTY' || cleanSymbol === 'NIFTY BANK') cleanSymbol = 'BANKNIFTY';
    cleanSymbol = cleanSymbol.replace(/\s+\d+$/, '').replace('-EQ', '');
    
    // Parse expiry date components
    let day = '', month = '', year = '', monthNum = '';
    if (typeof expiry === 'string' && expiry.match(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/)) {
      const parts = expiry.split('-');
      day = parts[0].padStart(2, '0');
      month = parts[1].toUpperCase();
      year = parts[2].slice(-2);
      const monthMap = { 'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
                         'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12' };
      monthNum = monthMap[month] || '01';
    }
    
    // Build multiple possible expiry code formats:
    // 1. DDMMMYY - e.g., 25NOV25 (used by NIFTY, BANKNIFTY index options)
    // 2. DDMMM - e.g., 25DEC (used by stock options like ITC, RELIANCE)
    // 3. YYMDD - e.g., 25D04 (used by SENSEX on BSE)
    const expiryPatterns = [];
    
    // Format 1: DDMMMYY (e.g., NIFTY25NOV2524000CE) - Index options
    expiryPatterns.push(`${cleanSymbol}${day}${month}${year}%`);
    
    // Format 2: DDMMM (e.g., ITC25DEC400CE) - Stock options
    expiryPatterns.push(`${cleanSymbol}${day}${month}%`);
    
    // Format 3: YY + M + DD where M is single letter month code (e.g., SENSEX25D04) - BSE indices
    const monthCodes = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6',
                         '07': '7', '08': '8', '09': '9', '10': 'O', '11': 'N', '12': 'D' };
    const monthCode = monthCodes[monthNum] || 'N';
    expiryPatterns.push(`${cleanSymbol}${year}${monthCode}${day}%`);
    
    console.log('[SymbolModel] getStrikes - Symbol:', cleanSymbol, 'expiry:', expiry, 'patterns:', expiryPatterns);
    
    // Query symbols matching any of the patterns
    const query = `
      SELECT DISTINCT symbol
      FROM symbols 
      WHERE (symbol LIKE ? OR symbol LIKE ? OR symbol LIKE ?)
      AND (symbol LIKE '%CE' OR symbol LIKE '%PE')
    `;
    
    const [rows] = await pool.query(query, expiryPatterns);
    console.log('[SymbolModel] getStrikes - Query found', rows.length, 'symbols');
    
    // Extract strikes from symbol names using multiple regex patterns
    const strikes = new Set();
    
    // Pattern 1: SYMBOL + DDMMMYY + STRIKE + CE/PE (e.g., NIFTY25NOV2524000CE) - Index options
    const regex1 = new RegExp(`^${cleanSymbol}${day}${month}${year}(\\d+(?:\\.\\d+)?)(CE|PE)$`, 'i');
    
    // Pattern 2: SYMBOL + DDMMM + STRIKE + CE/PE (e.g., ITC25DEC400CE) - Stock options
    const regex2 = new RegExp(`^${cleanSymbol}${day}${month}(\\d+(?:\\.\\d+)?)(CE|PE)$`, 'i');
    
    // Pattern 3: SYMBOL + YY + M + DD + STRIKE + CE/PE (e.g., SENSEX25D0475700CE) - BSE indices
    const regex3 = new RegExp(`^${cleanSymbol}${year}${monthCode}${day}(\\d+)(CE|PE)$`, 'i');
    
    for (const row of rows) {
      let match = row.symbol.match(regex1) || row.symbol.match(regex2) || row.symbol.match(regex3);
      if (match) {
        const strike = parseFloat(match[1]);
        if (!isNaN(strike) && strike > 0) {
          strikes.add(strike);
        }
      }
    }
    
    const sortedStrikes = Array.from(strikes).sort((a, b) => a - b);
    console.log('[SymbolModel] getStrikes - Found', sortedStrikes.length, 'unique strikes');
    
    return sortedStrikes;
  }

  /**
   * Get option contracts (CE and PE) for a symbol, expiry, and strike
   */
  static async getOptionContracts(underlyingSymbol, expiry, strike) {
    // Normalize symbol name - "Nifty 50" -> "NIFTY", "Nifty Bank" -> "BANKNIFTY"
    let cleanSymbol = (underlyingSymbol || '').trim().toUpperCase();
    if (cleanSymbol === 'NIFTY 50') cleanSymbol = 'NIFTY';
    if (cleanSymbol === 'BANK NIFTY' || cleanSymbol === 'NIFTY BANK') cleanSymbol = 'BANKNIFTY';
    cleanSymbol = cleanSymbol.replace(/\s+\d+$/, '').replace('-EQ', '');
    
    console.log('[SymbolModel] getOptionContracts - Original:', underlyingSymbol, '-> Cleaned:', cleanSymbol, 'expiry:', expiry, 'strike:', strike);
    
    // Convert expiry from DD-MMM-YYYY to date match
    const query = `
      SELECT 
        symbol,
        name,
        exchange,
        segment,
        token,
        instrument_type,
        strike_price,
        expiry_date,
        option_type,
        lot_size
      FROM symbols 
      WHERE symbol LIKE ?
      AND DATE(expiry_date) = DATE(?)
      AND strike_price = ?
      ORDER BY symbol
    `;
    
    // Parse the expiry date
    let expiryDate = expiry;
    if (typeof expiry === 'string' && expiry.match(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/)) {
      // Convert DD-MMM-YYYY to YYYY-MM-DD
      const parts = expiry.split('-');
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const month = monthMap[parts[1]] || '01';
      expiryDate = `${parts[2]}-${month}-${parts[0].padStart(2, '0')}`;
    }
    
    const [rows] = await pool.query(query, [`${cleanSymbol}%`, expiryDate, strike]);
    
    console.log('[SymbolModel] getOptionContracts - Found', rows.length, 'contracts:', rows.map(r => r.symbol).join(', '));
    
    // Determine CE/PE from symbol suffix since option_type column might be incorrect
    return {
      ce: rows.find(r => r.symbol.toUpperCase().endsWith('CE')) || null,
      pe: rows.find(r => r.symbol.toUpperCase().endsWith('PE')) || null
    };
  }
}

module.exports = SymbolModel;
