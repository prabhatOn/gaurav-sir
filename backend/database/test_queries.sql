-- Quick test queries for trading_demo database

-- 1. Check all exchanges
SELECT DISTINCT exchange FROM symbols ORDER BY exchange;

-- 2. Check segments for NSE
SELECT DISTINCT segment FROM symbols WHERE exchange = 'NSE' ORDER BY segment;

-- 3. Get all NSE equity symbols
SELECT symbol, name, token, exchange, segment 
FROM symbols 
WHERE exchange = 'NSE' AND segment = 'EQ'
ORDER BY symbol;

-- 4. Get token for a specific symbol
SELECT symbol, token, exchange, segment 
FROM symbols 
WHERE symbol = 'RELIANCE' AND exchange = 'NSE';

-- 5. Get NIFTY option chain for specific expiry
SELECT 
    symbol,
    strike_price,
    option_type,
    token,
    expiry_date
FROM symbols
WHERE symbol LIKE 'NIFTY24NOV%'
ORDER BY strike_price, option_type;

-- 6. Count symbols by exchange
SELECT exchange, COUNT(*) as symbol_count
FROM symbols
GROUP BY exchange
ORDER BY exchange;

-- 7. Check all indices
SELECT symbol, name, token
FROM symbols
WHERE instrument_type = 'INDEX'
ORDER BY symbol;

-- 8. Get specific strike options (example: NIFTY 24000)
SELECT 
    symbol,
    token,
    option_type,
    strike_price,
    expiry_date
FROM symbols
WHERE strike_price = 24000.00
AND symbol LIKE 'NIFTY%'
ORDER BY option_type;

-- 9. Verify table structure
DESCRIBE symbols;

-- 10. Count total symbols
SELECT COUNT(*) as total_symbols FROM symbols;
