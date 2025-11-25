const express = require('express');
const router = express.Router();
const SymbolModel = require('../models/SymbolModel');
const angelOneService = require('../services/angelOneService');

function normalizeQuoteResponse(raw) {
  const results = [];
  if (!raw || !raw.data) return results;
  
  // Handle different response formats from Smart API
  // Format 1: { data: { fetched: [...], unfetched: [...] } }
  // Format 2: { data: { NFO: [...], NSE: [...] } }
  let entries = [];
  
  if (raw.data.fetched && Array.isArray(raw.data.fetched)) {
    // Smart API quote response format
    entries = raw.data.fetched;
  } else {
    // Legacy format with exchange keys
    Object.entries(raw.data).forEach(([responseKey, items]) => {
      if (Array.isArray(items)) {
        entries.push(...items);
      }
    });
  }
  
  entries.forEach((entry) => {
    const token = entry.token || entry.symbolToken || entry.symboltoken || entry.instrument_token || entry.tokenNumber;
    const symbol = entry.symbol || entry.tradingSymbol || entry.tradingsymbol;
    // Get the actual exchange from the entry
    const actualExchange = entry.exchange || 'NFO';
    
    results.push({
      exchange: actualExchange,
      token: token ? String(token) : undefined,
      symbol,
      ltp: entry.ltp ?? entry.lastPrice ?? entry.last_traded_price ?? entry.close_price ?? entry.close,
      open: entry.open ?? entry.open_price ?? entry.openPrice,
      high: entry.high ?? entry.high_price ?? entry.highPrice,
      low: entry.low ?? entry.low_price ?? entry.lowPrice,
      close: entry.close ?? entry.close_price ?? entry.previousClose ?? entry.prevClose ?? entry.closePrice,
      atp: entry.avgPrice ?? entry.average_traded_price ?? entry.averagePrice ?? entry.avgTradedPrice,
      volume: entry.tradeVolume ?? entry.volume_traded ?? entry.volumeTraded ?? entry.totalTradedVolume,
      netChange: entry.netChange ?? entry.net_change ?? entry.change ?? entry.changeValue,
      percentChange: entry.percentChange ?? entry.percent_change ?? entry.changePercent,
      oi: entry.opnInterest ?? entry.openInterest ?? entry.open_interest ?? entry.oi,
      iv: entry.iv ?? entry.impliedVolatility ?? entry.implied_volatility,
      depth: entry.depth || null,
      timestamp: entry.exchFeedTime ?? entry.exchangeTime ?? entry.timestamp ?? new Date().toISOString(),
      raw: entry
    });
  });
  return results;
}

/**
 * GET /api/exchanges
 * Get all available exchanges
 */
router.get('/exchanges', async (req, res) => {
  try {
    const exchanges = await SymbolModel.getExchanges();
    res.json({ success: true, data: exchanges });
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/segments?exchange=NSE
 * Get segments by exchange
 */
router.get('/segments', async (req, res) => {
  try {
    const { exchange } = req.query;
    
    if (!exchange) {
      return res.status(400).json({ success: false, error: 'Exchange is required' });
    }
    
    const segments = await SymbolModel.getSegmentsByExchange(exchange);
    res.json({ success: true, data: segments });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/symbols?exchange=NSE&segment=EQ
 * Get symbols filtered by exchange and segment
 */
router.get('/symbols', async (req, res) => {
  try {
    const { exchange, segment } = req.query;
    
    if (!exchange || !segment) {
      return res.status(400).json({ 
        success: false, 
        error: 'Exchange and segment are required' 
      });
    }
    
    const symbols = await SymbolModel.getSymbols(exchange, segment);
    res.json({ success: true, data: symbols });
  } catch (error) {
    console.error('Error fetching symbols:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/symbol/:symbol?exchange=NSE
 * Get symbol token and details
 */
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange } = req.query;
    
    if (!exchange) {
      return res.status(400).json({ success: false, error: 'Exchange is required' });
    }
    
    const symbolData = await SymbolModel.getSymbolToken(symbol, exchange);
    
    if (!symbolData) {
      return res.status(404).json({ success: false, error: 'Symbol not found' });
    }
    
    res.json({ success: true, data: symbolData });
  } catch (error) {
    console.error('Error fetching symbol:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/symbols/search?q=NIFTY&limit=50
 * Simple search - searches database by symbol or name
 */
router.get('/symbols/search', async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    
    console.log('[API] Symbol search - q:', q);
    
    // If no search query, return empty (frontend shows popular symbols)
    if (!q || q.trim() === '') {
      res.json({ success: true, data: [] });
      return;
    }
    
    // Search database
    const symbols = await SymbolModel.searchSymbols(q);
    console.log('[API] Found', symbols.length, 'symbols for query:', q);
    res.json({ success: true, data: symbols.slice(0, parseInt(limit)) });
  } catch (error) {
    console.error('Error searching symbols:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/symbols/:symbol (plural - alias for compatibility)
 * Get symbol token and details - auto-detects exchange
 */
router.get('/symbols/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const requestedExchange = req.query.exchange;
    
    console.log('[API] Fetching symbol details for:', symbol, 'requested exchange:', requestedExchange);
    
    // Try multiple methods to find the symbol
    let symbolData = null;
    
    // Method 1: Use getSymbolByExactMatch which tries multiple patterns
    symbolData = await SymbolModel.getSymbolByExactMatch(symbol);
    
    // Method 2: If not found, try with specific exchanges
    if (!symbolData) {
      const exchangesToTry = requestedExchange 
        ? [requestedExchange, 'NSE', 'BSE', 'NFO', 'BFO']
        : ['NSE', 'BSE', 'NFO', 'BFO'];
      
      for (const ex of exchangesToTry) {
        symbolData = await SymbolModel.getSymbolToken(symbol, ex);
        if (symbolData) {
          console.log('[API] Found symbol in exchange:', ex);
          break;
        }
      }
    }
    
    if (!symbolData) {
      console.log('[API] Symbol not found:', symbol);
      return res.status(404).json({ status: false, error: 'Symbol not found' });
    }
    
    // Add symbol name and lot_size field for compatibility
    symbolData.symbol = symbol;
    if (!symbolData.lot_size) {
      symbolData.lot_size = 1;
    }
    
    console.log('[API] Returning symbol data:', symbolData);
    res.json({ status: true, data: symbolData });
  } catch (error) {
    console.error('Error fetching symbol:', error);
    res.status(500).json({ status: false, error: error.message });
  }
});

/**
 * GET /api/symbols/:symbol/expiries
 * Get available expiry dates for a symbol
 */
router.get('/symbols/:symbol/expiries', async (req, res) => {
  try {
    const { symbol } = req.params;
    const expiries = await SymbolModel.getExpiries(symbol);
    
    // Format dates as DD-MMM-YYYY (e.g., 25-Nov-2025)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedExpiries = expiries.map(exp => {
      const date = new Date(exp);
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    });
    
    res.json({ status: true, data: formattedExpiries });
  } catch (error) {
    console.error('Error fetching expiries:', error);
    res.status(500).json({ status: false, error: error.message });
  }
});

/**
 * GET /api/symbols/:symbol/expiries/:expiry/strikes
 * Get available strikes for a symbol and expiry
 */
router.get('/symbols/:symbol/expiries/:expiry/strikes', async (req, res) => {
  try {
    const { symbol, expiry } = req.params;
    const strikes = await SymbolModel.getStrikes(symbol, expiry);
    res.json({ status: true, data: strikes });
  } catch (error) {
    console.error('Error fetching strikes:', error);
    res.status(500).json({ status: false, error: error.message });
  }
});

/**
 * GET /api/symbols/:symbol/option-contracts?expiry=DD-MMM-YYYY&strike=24000
 * Get CE and PE option contract tokens for a symbol, expiry and strike
 */
router.get('/symbols/:symbol/option-contracts', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { expiry, strike } = req.query;
    
    if (!expiry || !strike) {
      return res.status(400).json({ success: false, error: 'expiry and strike are required' });
    }
    
    console.log('[API] Fetching option contracts for:', symbol, 'expiry:', expiry, 'strike:', strike);
    
    const contracts = await SymbolModel.getOptionContracts(symbol, expiry, Number(strike));
    
    console.log('[API] Option contracts found:', contracts);
    
    res.json({ success: true, data: contracts });
  } catch (error) {
    console.error('Error fetching option contracts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/quote
 * Get full market quote data from Angel One API
 * Body: { "mode": "FULL", "exchangeTokens": { "NSE": ["3045","881"], "NFO": ["58662"] } }
 */
router.post('/quote', async (req, res) => {
  try {
    const { exchangeTokens } = req.body;
    
    if (!exchangeTokens || typeof exchangeTokens !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'exchangeTokens object is required' 
      });
    }
    
    const quoteData = await angelOneService.getQuoteData(exchangeTokens);
    res.json({ success: true, data: quoteData });
  } catch (error) {
    console.error('Error fetching quote data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/quotes/full/:symbol?exchange=NSE
 * Convenience endpoint to fetch full-mode quote for a single symbol
 */
router.get('/quotes/full/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const exchange = req.query.exchange || 'NSE';

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'symbol is required' });
    }

    const symbolData = await SymbolModel.getSymbolToken(symbol, exchange);
    if (!symbolData) {
      return res.status(404).json({ success: false, error: 'Symbol not found' });
    }

    const payload = await angelOneService.getQuoteData({ [symbolData.exchange || exchange]: [String(symbolData.token)] }, 'FULL');
    const normalized = normalizeQuoteResponse(payload);
    res.json({ success: true, data: normalized[0] || null });
  } catch (error) {
    console.error('Error fetching full quote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/quotes/full
 * Body: { tokens: [{ exchange: 'NSE', token: '26000' }] }
 */
router.post('/quotes/full', async (req, res) => {
  try {
    const { tokens } = req.body;
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'tokens array is required' });
    }

    const exchangeTokens = tokens.reduce((acc, entry) => {
      const exchange = (entry.exchange || 'NSE').toUpperCase();
      const token = entry.token || entry.symbolToken;
      if (!token) return acc;
      if (!acc[exchange]) acc[exchange] = [];
      acc[exchange].push(String(token));
      return acc;
    }, {});

    if (Object.keys(exchangeTokens).length === 0) {
      return res.json({ success: true, data: [] });
    }

    const quoteResponse = await angelOneService.getQuoteData(exchangeTokens, 'FULL');
    const normalized = normalizeQuoteResponse(quoteResponse);
    res.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Error fetching full quotes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search
 * Search symbols by partial name match
 * Body: { "searchTerm": "NIFTY", "exchange": "NSE", "segment": "EQ" }
 */
router.post('/search', async (req, res) => {
  try {
    const { searchTerm, exchange, segment } = req.body;
    
    if (!searchTerm) {
      return res.status(400).json({ success: false, error: 'searchTerm is required' });
    }
    
    const symbols = await SymbolModel.searchSymbols(searchTerm, exchange, segment);
    res.json({ success: true, data: symbols });
  } catch (error) {
    console.error('Error searching symbols:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/option-chain/:underlying?expiry=2024-11-28
 * Get option chain for underlying symbol with Greeks and IV
 */
router.get('/option-chain/:underlying', async (req, res) => {
  try {
    const { underlying } = req.params;
    const { expiry } = req.query;
    
    // Normalize underlying symbol name
    let cleanUnderlying = (underlying || '').trim().toUpperCase();
    if (cleanUnderlying === 'NIFTY 50' || cleanUnderlying === 'NIFTY50') cleanUnderlying = 'NIFTY';
    if (cleanUnderlying === 'BANK NIFTY' || cleanUnderlying === 'NIFTY BANK') cleanUnderlying = 'BANKNIFTY';
    
    const optionChain = await SymbolModel.getOptionChain(underlying, expiry);
    
    // Group by strike price
    const groupedByStrike = optionChain.reduce((acc, option) => {
      const strike = option.strike_price;
      if (!acc[strike]) {
        acc[strike] = { strike_price: strike, CE: null, PE: null };
      }
      
      if (option.option_type === 'CE') {
        acc[strike].CE = option;
      } else if (option.option_type === 'PE') {
        acc[strike].PE = option;
      }
      
      return acc;
    }, {});
    
    const formattedData = Object.values(groupedByStrike)
      .sort((a, b) => parseFloat(a.strike_price) - parseFloat(b.strike_price));

    // Fetch Option Greeks (IV, Delta, Gamma, Theta, Vega) from Smart API
    let greeksMap = new Map();
    try {
      // Convert expiry from DD-MMM-YYYY to DDMMMYYYY format for API
      let greeksExpiry = '';
      if (expiry && expiry.match(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/)) {
        const [day, month, year] = expiry.split('-');
        greeksExpiry = `${day.padStart(2, '0')}${month.toUpperCase()}${year}`;
      }
      
      if (greeksExpiry) {
        console.log(`📊 Fetching Greeks for ${cleanUnderlying} expiry ${greeksExpiry}`);
        const greeksResponse = await angelOneService.getOptionGreeks(cleanUnderlying, greeksExpiry);
        
        if (greeksResponse?.status && Array.isArray(greeksResponse.data)) {
          greeksResponse.data.forEach(g => {
            // Key: strike_optionType (e.g., "24000.000000_CE")
            const key = `${parseFloat(g.strikePrice).toFixed(2)}_${g.optionType}`;
            greeksMap.set(key, {
              delta: parseFloat(g.delta) || 0,
              gamma: parseFloat(g.gamma) || 0,
              theta: parseFloat(g.theta) || 0,
              vega: parseFloat(g.vega) || 0,
              iv: parseFloat(g.impliedVolatility) || 0,
              tradeVolume: parseFloat(g.tradeVolume) || 0
            });
          });
          console.log(`✅ Fetched Greeks for ${greeksMap.size} strikes`);
        }
      }
    } catch (greeksError) {
      console.warn('⚠️ Option Greeks fetch failed:', greeksError.message);
    }

    // Fetch live quotes for all tokens to enrich option data
    // Smart API has a limit of ~50 tokens per request, so we batch
    const BATCH_SIZE = 50;
    const allTokens = [];
    formattedData.forEach(item => {
      ['CE', 'PE'].forEach(side => {
        const option = item[side];
        if (option?.token && option?.exchange) {
          allTokens.push({
            token: String(option.token),
            exchange: option.exchange.toUpperCase()
          });
        }
      });
    });

    let quotesMap = new Map();
    try {
      // Process tokens in batches
      for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        const batch = allTokens.slice(i, i + BATCH_SIZE);
        
        // Group batch by exchange
        const exchangeTokens = {};
        batch.forEach(({ token, exchange }) => {
          if (!exchangeTokens[exchange]) {
            exchangeTokens[exchange] = [];
          }
          exchangeTokens[exchange].push(token);
        });
        
        if (Object.keys(exchangeTokens).length > 0) {
          const quoteResponse = await angelOneService.getQuoteData(exchangeTokens, 'FULL');
          const normalizedQuotes = normalizeQuoteResponse(quoteResponse);
          normalizedQuotes.forEach(q => {
            quotesMap.set(`${q.exchange}:${q.token}`, q);
          });
        }
      }
      console.log(`✅ Fetched quotes for ${quotesMap.size} tokens in ${Math.ceil(allTokens.length / BATCH_SIZE)} batches`);
    } catch (quoteError) {
      console.warn('⚠️ Option chain quote enrichment failed:', quoteError.message);
    }

    // Merge quotes and Greeks into formattedData
    formattedData.forEach(item => {
      ['CE', 'PE'].forEach(side => {
        const option = item[side];
        if (!option) return;
        
        // Merge quote data
        if (option.token && option.exchange) {
          const quote = quotesMap.get(`${option.exchange.toUpperCase()}:${option.token}`);
          if (quote) {
            option.marketData = quote;
            option.ltp = quote.ltp;
            option.open = quote.open;
            option.high = quote.high;
            option.low = quote.low;
            option.close = quote.close;
            option.oi = quote.oi;
            option.depth = quote.depth;
            option.netChange = quote.netChange;
            option.percentChange = quote.percentChange;
          }
        }
        
        // Merge Greeks data
        const strikeKey = `${parseFloat(option.strike_price).toFixed(2)}_${side}`;
        const greeks = greeksMap.get(strikeKey);
        if (greeks) {
          option.iv = greeks.iv;
          option.delta = greeks.delta;
          option.gamma = greeks.gamma;
          option.theta = greeks.theta;
          option.vega = greeks.vega;
          if (option.marketData) {
            option.marketData.iv = greeks.iv;
            option.marketData.delta = greeks.delta;
            option.marketData.gamma = greeks.gamma;
            option.marketData.theta = greeks.theta;
            option.marketData.vega = greeks.vega;
          }
        }
      });
    });
    
    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching option chain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/indices
 * Get only major indices (NIFTY, BANKNIFTY, FINNIFTY, etc.)
 */
router.get('/indices', async (req, res) => {
  try {
    const indices = await SymbolModel.getIndices();
    res.json({ success: true, data: indices });
  } catch (error) {
    console.error('Error fetching indices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    websocket: angelOneService.isConnected,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
