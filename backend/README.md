# Trading Platform Backend Server 🚀

A comprehensive, production-ready backend server for a trading platform with real-time market data integration, order management, and portfolio tracking.

## ✨ Features Overview

### 📡 Real-Time Market Data
- **Angel One WebSocket Integration**: Live streaming from NSE, BSE, MCX
- **Automatic Reconnection**: Robust connection handling with auto-reconnect
- **Multi-Client Support**: Handle multiple WebSocket clients simultaneously
- **Token Subscription**: Subscribe/unsubscribe to specific instruments
- **Real-Time Quotes**: LTP, High, Low, Open, Close, Volume, OI, IV

### 📊 Symbol Management
- **Symbol Search**: Search across all exchanges and segments
- **Exchange Filtering**: NSE, BSE, MCX, NFO filtering
- **Segment Filtering**: CASH, OPTIONS, FUTURES, INDICES
- **Option Chain**: Complete option chain data with strikes and expiries
- **Expiry Dates**: Get available expiry dates for derivatives
- **Strike Prices**: Get strike prices for options

### 📈 Order Management
- **Order Types**: MARKET, LIMIT, MARKET_PROTECTION, SL-M, SL-L
- **Product Types**: INTRADAY, MARGIN (CNC/Delivery)
- **Paper Trading**: Test strategies without real money
- **Live Trading**: Execute real orders through Angel One
- **Market Protection**: Built-in 2% circuit breaker protection
- **Predefined SL**: Automatic stop-loss order creation
- **Target Price**: Automatic target order creation

### 💼 Position Management
- **Real-Time P&L**: Live profit/loss calculation
- **Position Tracking**: Track all open positions
- **Position Closing**: Close positions with market/limit orders
- **Multi-Broker Support**: Handle multiple broker accounts

### 🎯 Trading Features
- **Basket Orders**: Save and execute basket of orders
- **Strategy Builder**: Create and save trading strategies
- **Risk Management**: Position sizing and risk controls

## 🏗️ Architecture

```
Frontend (Next.js + Socket.IO Client)
    ↓ WebSocket & REST API
Backend Server (Express + Socket.IO)
    ↓ WebSocket
Angel One SmartAPI WebSocket
    ↓ REST API
Angel One Quote API
    ↓ MySQL
Symbol Database
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` in the root directory and update:

```env
# Angel One API Credentials
SMARTAPI_FEED_TOKEN=your_feed_token
SMARTAPI_API_KEY=your_api_key
SMARTAPI_CLIENT_CODE=your_client_code
SMARTAPI_JWT=your_jwt_token

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=trading_demo

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### 3. Setup Database

Run the SQL schema to create tables:

```bash
mysql -u root -p < database/schema.sql
```

Or import manually in phpMyAdmin/MySQL Workbench.

### 4. Start Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### REST API

#### Get Exchanges
```
GET /api/exchanges
Response: { success: true, data: ["NSE", "NFO", "BSE", "BFO"] }
```

#### Get Segments
```
GET /api/segments?exchange=NSE
Response: { success: true, data: ["EQ", "INDICES"] }
```

#### Get Symbols
```
GET /api/symbols?exchange=NSE&segment=EQ
Response: { success: true, data: [{ symbol, name, token, ... }] }
```

#### Get Symbol Token
```
GET /api/symbol/RELIANCE?exchange=NSE
Response: { success: true, data: { symbol, token, exchange, ... } }
```

#### Get Quote Data
```
POST /api/quote
Body: {
  "exchangeTokens": {
    "NSE": ["3045", "881"],
    "NFO": ["58662"]
  }
}
Response: { success: true, data: {...} }
```

#### Search Symbols
```
POST /api/search
Body: { "searchTerm": "NIFTY", "exchange": "NSE" }
Response: { success: true, data: [...] }
```

#### Get Option Chain
```
GET /api/option-chain/NIFTY?expiry=2024-11-28
Response: { success: true, data: [{ strike_price, CE: {...}, PE: {...} }] }
```

#### Health Check
```
GET /api/health
Response: { success: true, status: "healthy", websocket: true }
```

### WebSocket (Socket.IO)

#### Connect
```javascript
const socket = io('http://localhost:5000');
```

#### Subscribe to Market Data
```javascript
socket.emit('subscribe', {
  tokens: [
    { exchange: "NSE", token: "3045" },
    { exchange: "NFO", token: "58662" }
  ],
  mode: 3  // 1=LTP, 2=QUOTE, 3=SNAP_QUOTE
});
```

#### Receive Market Data
```javascript
socket.on('marketData', (data) => {
  console.log('Market update:', data);
});
```

#### Unsubscribe
```javascript
socket.emit('unsubscribe', {
  tokens: [
    { exchange: "NSE", token: "3045" }
  ]
});
```

## Flow Diagram

```
User Action:
1. Select Exchange (NSE/NFO/BSE) → GET /api/exchanges
2. Select Segment (EQ/INDICES/OPTIDX) → GET /api/segments?exchange=NSE
3. Select Symbol (RELIANCE/NIFTY) → GET /api/symbols?exchange=NSE&segment=EQ

Backend Process:
4. Search symbol in DB → SymbolModel.getSymbolToken()
5. Get token from DB → token: "3045"
6. Fetch quote data → POST to Angel One API
7. Subscribe to WebSocket → angelOneService.subscribeToSymbols()
8. Receive real-time data → WebSocket stream
9. Broadcast to frontend → Socket.IO emit 'marketData'

Frontend Display:
10. Show data in charts (CE/PE/Current)
11. Show option chain with live prices
12. Show premium charts with real-time updates
```

## Database Schema

### symbols table
- `symbol_id` - Primary key
- `symbol` - Symbol name (e.g., RELIANCE, NIFTY24NOV24000CE)
- `name` - Full name
- `exchange` - NSE, NFO, BSE, BFO
- `segment` - EQ, INDICES, OPTIDX
- `token` - Angel One token for WebSocket
- `instrument_type` - EQ, CE, PE, INDEX
- `strike_price` - For options
- `expiry_date` - For options
- `option_type` - CE or PE
- `lot_size` - Trading lot size

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:load
npm run test:error
```

## Troubleshooting

### Database Connection Failed
- Check MySQL is running
- Verify credentials in `.env.local`
- Ensure `trading_demo` database exists

### WebSocket Not Connecting
- Verify Angel One credentials are correct
- Check if JWT token is expired (regenerate if needed)
- Ensure feed token is valid

### No Market Data Received
- Check if markets are open
- Verify token numbers are correct
- Check Angel One API status

## Notes

- This is an individual project (no authentication required)
- Angel One tokens expire daily, regenerate as needed
- WebSocket auto-reconnects on disconnection
- Real-time data only available during market hours
- Use mode=3 (SNAP_QUOTE) for full market depth

## License

Private Project
