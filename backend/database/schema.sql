-- Trading Demo Database Schema
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS trading_pro;
USE trading_pro;

-- Symbols table to store all tradeable instruments
CREATE TABLE IF NOT EXISTS symbols (
  symbol_id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  exchange VARCHAR(20) NOT NULL,
  segment VARCHAR(50) NOT NULL,
  token VARCHAR(50) NOT NULL,
  instrument_type VARCHAR(20),
  strike_price DECIMAL(10, 2) DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  option_type VARCHAR(5) DEFAULT NULL,
  lot_size INT DEFAULT 1,
  tick_size DECIMAL(10, 4) DEFAULT 0.05,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol),
  INDEX idx_exchange_segment (exchange, segment),
  INDEX idx_token (token, exchange),
  INDEX idx_expiry (expiry_date),
  UNIQUE KEY unique_symbol_exchange (symbol, exchange, token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample data for NSE equity
INSERT IGNORE INTO symbols (symbol, name, exchange, segment, token, instrument_type, lot_size) VALUES
('RELIANCE', 'Reliance Industries Ltd', 'NSE', 'EQ', '2885', 'EQ', 1),
('TCS', 'Tata Consultancy Services Ltd', 'NSE', 'EQ', '11536', 'EQ', 1),
('INFY', 'Infosys Ltd', 'NSE', 'EQ', '1594', 'EQ', 1),
('HDFCBANK', 'HDFC Bank Ltd', 'NSE', 'EQ', '1333', 'EQ', 1),
('ICICIBANK', 'ICICI Bank Ltd', 'NSE', 'EQ', '4963', 'EQ', 1),
('SBIN', 'State Bank of India', 'NSE', 'EQ', '3045', 'EQ', 1),
('BHARTIARTL', 'Bharti Airtel Ltd', 'NSE', 'EQ', '10604', 'EQ', 1),
('ITC', 'ITC Ltd', 'NSE', 'EQ', '1660', 'EQ', 1),
('KOTAKBANK', 'Kotak Mahindra Bank Ltd', 'NSE', 'EQ', '1922', 'EQ', 1),
('LT', 'Larsen & Toubro Ltd', 'NSE', 'EQ', '11483', 'EQ', 1);

-- Sample data for NIFTY index
INSERT IGNORE INTO symbols (symbol, name, exchange, segment, token, instrument_type) VALUES
('NIFTY 50', 'Nifty 50 Index', 'NSE', 'INDICES', '26000', 'INDEX'),
('BANKNIFTY', 'Bank Nifty Index', 'NSE', 'INDICES', '26009', 'INDEX'),
('FINNIFTY', 'Fin Nifty Index', 'NSE', 'INDICES', '26037', 'INDEX');

-- Sample NIFTY options (you'll need to add current month expiry options)
-- Format: NIFTY[DDMMMYY][STRIKE][CE/PE]
-- Example for demonstration (update with real tokens from Angel One)
INSERT IGNORE INTO symbols (symbol, name, exchange, segment, token, instrument_type, strike_price, expiry_date, option_type, lot_size) VALUES
('NIFTY24NOV24000CE', 'NIFTY 24 NOV 24000 CE', 'NFO', 'OPTIDX', '50001', 'CE', 24000.00, '2024-11-28', 'CE', 50),
('NIFTY24NOV24000PE', 'NIFTY 24 NOV 24000 PE', 'NFO', 'OPTIDX', '50002', 'PE', 24000.00, '2024-11-28', 'PE', 50),
('NIFTY24NOV24500CE', 'NIFTY 24 NOV 24500 CE', 'NFO', 'OPTIDX', '50003', 'CE', 24500.00, '2024-11-28', 'CE', 50),
('NIFTY24NOV24500PE', 'NIFTY 24 NOV 24500 PE', 'NFO', 'OPTIDX', '50004', 'PE', 24500.00, '2024-11-28', 'PE', 50),
('NIFTY24NOV25000CE', 'NIFTY 24 NOV 25000 CE', 'NFO', 'OPTIDX', '50005', 'CE', 25000.00, '2024-11-28', 'CE', 50),
('NIFTY24NOV25000PE', 'NIFTY 24 NOV 25000 PE', 'NFO', 'OPTIDX', '50006', 'PE', 25000.00, '2024-11-28', 'PE', 50);

-- Sample BANKNIFTY options
INSERT IGNORE INTO symbols (symbol, name, exchange, segment, token, instrument_type, strike_price, expiry_date, option_type, lot_size) VALUES
('BANKNIFTY24NOV51000CE', 'BANKNIFTY 24 NOV 51000 CE', 'NFO', 'OPTIDX', '60001', 'CE', 51000.00, '2024-11-27', 'CE', 15),
('BANKNIFTY24NOV51000PE', 'BANKNIFTY 24 NOV 51000 PE', 'NFO', 'OPTIDX', '60002', 'PE', 51000.00, '2024-11-27', 'PE', 15),
('BANKNIFTY24NOV51500CE', 'BANKNIFTY 24 NOV 51500 CE', 'NFO', 'OPTIDX', '60003', 'CE', 51500.00, '2024-11-27', 'CE', 15),
('BANKNIFTY24NOV51500PE', 'BANKNIFTY 24 NOV 51500 PE', 'NFO', 'OPTIDX', '60004', 'PE', 51500.00, '2024-11-27', 'PE', 15),
('BANKNIFTY24NOV52000CE', 'BANKNIFTY 24 NOV 52000 CE', 'NFO', 'OPTIDX', '60005', 'CE', 52000.00, '2024-11-27', 'CE', 15),
('BANKNIFTY24NOV52000PE', 'BANKNIFTY 24 NOV 52000 PE', 'NFO', 'OPTIDX', '60006', 'PE', 52000.00, '2024-11-27', 'PE', 15);

-- BSE sample data
INSERT IGNORE INTO symbols (symbol, name, exchange, segment, token, instrument_type, lot_size) VALUES
('SENSEX', 'S&P BSE Sensex', 'BSE', 'INDICES', '1', 'INDEX', 1),
('RELIANCE', 'Reliance Industries Ltd', 'BSE', 'EQ', '500325', 'EQ', 1),
('TCS', 'Tata Consultancy Services Ltd', 'BSE', 'EQ', '532540', 'EQ', 1);

-- Market data cache table (optional - for storing last known prices)
CREATE TABLE IF NOT EXISTS market_data_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(100) NOT NULL,
  exchange VARCHAR(20) NOT NULL,
  token VARCHAR(50) NOT NULL,
  ltp DECIMAL(10, 2),
  open DECIMAL(10, 2),
  high DECIMAL(10, 2),
  low DECIMAL(10, 2),
  close DECIMAL(10, 2),
  volume BIGINT,
  change_percent DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_token_exchange (token, exchange),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Watchlist table (optional - for user watchlists)
CREATE TABLE IF NOT EXISTS watchlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol_id (symbol_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- ADDITIONAL TABLES FOR TRADING FEATURES
-- ============================================================================

-- Brokers table - stores broker configurations for multi-broker support
CREATE TABLE IF NOT EXISTS brokers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  broker_type VARCHAR(50) NOT NULL,
  api_key VARCHAR(255),
  api_secret VARCHAR(255),
  access_token VARCHAR(255),
  refresh_token VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  health_status VARCHAR(50) DEFAULT 'unknown',
  last_health_check TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_broker_type (broker_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample broker data
INSERT IGNORE INTO brokers (name, broker_type, is_active, health_status) VALUES
('Angel One', 'angelone', true, 'connected'),
('Paper Trading Account', 'paper', true, 'active');

-- Orders table - stores all orders (paper and live trading)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE,
  symbol VARCHAR(50) NOT NULL,
  symbol_id INT,
  order_type VARCHAR(20) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2),
  trigger_price DECIMAL(10,2),
  product_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  broker_id INT,
  trading_mode VARCHAR(10) NOT NULL DEFAULT 'paper',
  order_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP NULL,
  average_price DECIMAL(10,2),
  filled_quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol_id) REFERENCES symbols(symbol_id) ON DELETE SET NULL,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_broker_id (broker_id),
  INDEX idx_trading_mode (trading_mode),
  INDEX idx_order_timestamp (order_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Positions table - stores open positions
CREATE TABLE IF NOT EXISTS positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  symbol_id INT,
  quantity INT NOT NULL,
  average_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  unrealized_pnl DECIMAL(15,2) DEFAULT 0,
  broker_id INT,
  trading_mode VARCHAR(10) NOT NULL DEFAULT 'paper',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol_id) REFERENCES symbols(symbol_id) ON DELETE SET NULL,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_broker_id (broker_id),
  INDEX idx_trading_mode (trading_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trades table - stores completed trades history
CREATE TABLE IF NOT EXISTS trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  symbol_id INT,
  transaction_type VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  broker_id INT,
  trading_mode VARCHAR(10) NOT NULL DEFAULT 'paper',
  trade_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol_id) REFERENCES symbols(symbol_id) ON DELETE SET NULL,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_broker_id (broker_id),
  INDEX idx_trading_mode (trading_mode),
  INDEX idx_trade_timestamp (trade_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Baskets table - stores saved basket orders
CREATE TABLE IF NOT EXISTS baskets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Basket positions table - stores positions within each basket
CREATE TABLE IF NOT EXISTS basket_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  basket_id INT NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  expiry DATE,
  strike DECIMAL(10,2),
  option_type VARCHAR(10),
  quantity INT NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  price DECIMAL(10,2),
  ltp DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (basket_id) REFERENCES baskets(id) ON DELETE CASCADE,
  INDEX idx_basket_id (basket_id),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Broker funds table - stores margin and balance information
CREATE TABLE IF NOT EXISTS broker_funds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  broker_id INT NOT NULL,
  available_margin DECIMAL(15,2) DEFAULT 0,
  used_margin DECIMAL(15,2) DEFAULT 0,
  total_balance DECIMAL(15,2) DEFAULT 0,
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  unrealized_pnl DECIMAL(15,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_broker (broker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample funds data
INSERT IGNORE INTO broker_funds (broker_id, available_margin, total_balance) VALUES
(2, 100000.00, 100000.00);

-- Holdings table - stores long-term holdings
CREATE TABLE IF NOT EXISTS holdings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  symbol_id INT,
  quantity INT NOT NULL,
  average_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  broker_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol_id) REFERENCES symbols(symbol_id) ON DELETE SET NULL,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_broker_id (broker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Column settings table - stores user preferences for table columns
CREATE TABLE IF NOT EXISTS column_settings (
  table_name VARCHAR(50) PRIMARY KEY,
  settings TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Accounts table - stores paper trading account balances
CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL DEFAULT 'paper',
  balance DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
  available_margin DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
  used_margin DECIMAL(15,2) DEFAULT 0,
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  unrealized_pnl DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample paper trading account
INSERT IGNORE INTO accounts (account_type, balance, available_margin) VALUES
('paper', 100000.00, 100000.00);
