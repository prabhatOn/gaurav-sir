# 🚀 Trading Platform Backend - Complete Implementation

## ✅ What Has Been Built

### Backend Architecture
A complete Node.js/Express backend with:
- **Real-time WebSocket** integration with Angel One SmartAPI
- **MySQL database** for symbol master data
- **Socket.IO server** for frontend real-time communication
- **REST API** for data queries and symbol search
- **Automatic reconnection** and error handling

### File Structure Created
```
backend/
├── config/
│   └── database.js              # MySQL connection pool
├── models/
│   └── SymbolModel.js           # Symbol data access layer
├── routes/
│   └── api.js                   # REST API endpoints
├── services/
│   └── angelOneService.js       # Angel One WebSocket client
├── database/
│   └── schema.sql               # Database schema with sample data
├── server.js                    # Main server (Express + Socket.IO)
├── package.json                 # Dependencies
├── .gitignore                   # Git ignore file
└── README.md                    # Documentation

Frontend Integration:
lib/
└── api.ts                       # API utility functions

hooks/
└── use-backend-socket.tsx       # React hook for Socket.IO

Scripts:
├── start-backend.bat            # Windows batch script
└── start-backend.ps1            # PowerShell script
```

## 🔄 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Select Exchange                                              │
│     Frontend → GET /api/exchanges                                │
│     Response: ["NSE", "NFO", "BSE", "BFO"]                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Select Segment (filtered by exchange)                        │
│     Frontend → GET /api/segments?exchange=NSE                    │
│     Backend → Query MySQL symbols table                          │
│     Response: ["EQ", "INDICES"]                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Select Symbol (filtered by exchange + segment)               │
│     Frontend → GET /api/symbols?exchange=NSE&segment=EQ          │
│     Backend → Query MySQL symbols table                          │
│     Response: [{symbol, name, token, ...}, ...]                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Get Symbol Token from Database                               │
│     Backend → Search symbols table by symbol name                │
│     Result: { symbol: "RELIANCE", token: "2885", exchange: "NSE"}│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Fetch Full Mode Quote Data                                   │
│     Backend → POST to Angel One Quote API                        │
│     URL: /rest/secure/angelbroking/market/v1/quote/             │
│     Body: {                                                      │
│       "mode": "FULL",                                            │
│       "exchangeTokens": {                                        │
│         "NSE": ["2885"],                                         │
│         "NFO": ["58662"]                                         │
│       }                                                          │
│     }                                                            │
│     Response: Complete market data (LTP, OHLC, Volume, etc.)    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Subscribe to Real-time WebSocket                             │
│     Frontend → socket.emit('subscribe', {                        │
│       tokens: [{exchange: "NSE", token: "2885"}],               │
│       mode: 3                                                    │
│     })                                                           │
│     Backend → Connect to Angel One WebSocket                     │
│     Backend → Send subscription message                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Receive Live Market Data Stream                              │
│     Angel One WS → Backend (real-time ticks)                     │
│     Backend → Parse binary/JSON data                             │
│     Backend → socket.io.emit('marketData', data)                 │
│     Frontend → socket.on('marketData', callback)                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Display in UI Components                                     │
│     ├─ Three Horizontal Line Charts (CE/PE/Current)             │
│     ├─ Option Chain with Live Prices                            │
│     └─ Premium Charts (GeeksGreek style)                        │
│         All updated in real-time via WebSocket                   │
└─────────────────────────────────────────────────────────────────┘
```

## 📡 API Endpoints

### REST Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/exchanges` | Get all exchanges | - |
| GET | `/api/segments` | Get segments by exchange | `?exchange=NSE` |
| GET | `/api/symbols` | Get filtered symbols | `?exchange=NSE&segment=EQ` |
| GET | `/api/symbol/:symbol` | Get symbol token | `?exchange=NSE` |
| POST | `/api/quote` | Get full quote data | Body: exchangeTokens |
| POST | `/api/search` | Search symbols | Body: searchTerm |
| GET | `/api/option-chain/:underlying` | Get option chain | `?expiry=2024-11-28` |
| GET | `/api/health` | Health check | - |

### WebSocket Events (Socket.IO)

**Client → Server:**
- `subscribe` - Subscribe to market data
- `unsubscribe` - Unsubscribe from symbols
- `getSubscriptions` - Get active subscriptions

**Server → Client:**
- `marketData` - Real-time market updates
- `subscribed` - Subscription confirmation
- `unsubscribed` - Unsubscription confirmation
- `error` - Error messages

## 🗄️ Database Schema

### symbols table
```sql
- symbol_id (PK)
- symbol (e.g., "RELIANCE", "NIFTY24NOV24000CE")
- name (full name)
- exchange (NSE, NFO, BSE, BFO, MCX)
- segment (EQ, INDICES, OPTIDX, FUTIDX)
- token (Angel One token for WebSocket)
- instrument_type (EQ, CE, PE, INDEX, FUT)
- strike_price (for options)
- expiry_date (for derivatives)
- option_type (CE/PE)
- lot_size
- tick_size
```

**Includes sample data:**
- 10 NSE equity symbols (RELIANCE, TCS, INFY, etc.)
- Index symbols (NIFTY 50, BANKNIFTY, FINNIFTY)
- Sample NIFTY options (CE/PE pairs)
- Sample BANKNIFTY options

## 🚀 Quick Start

### 1. Database Setup
```bash
# Start MySQL
# Create database and import schema
mysql -u root -p
```
```sql
source B:/projects/gaurav-new/backend/database/schema.sql
```

### 2. Start Backend
```powershell
# Using PowerShell script
.\start-backend.ps1

# Or manually
cd backend
npm start
```

### 3. Test Connection
```bash
# Health check
curl http://localhost:5000/api/health

# Get exchanges
curl http://localhost:5000/api/exchanges
```

### 4. Frontend Integration
```typescript
import { useBackendSocket } from '@/hooks/use-backend-socket';
import { getExchanges, getSymbols } from '@/lib/api';

function TradingComponent() {
  const { connected, marketData, subscribe } = useBackendSocket();
  
  // Subscribe to symbols
  subscribe([
    { exchange: "NSE", token: "2885" }
  ], 3);
  
  // Access real-time data
  const reliance = marketData["2885"];
}
```

## 🔧 Configuration

### Environment Variables (.env.local)
```env
# Angel One Credentials
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

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## 📦 Dependencies Installed

### Backend
- `express` - Web framework
- `socket.io` - Real-time communication
- `mysql2` - MySQL client
- `axios` - HTTP client for Angel One API
- `ws` - WebSocket client
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `nodemon` - Dev auto-reload (devDependency)

### Frontend (already installed)
- `socket.io-client` - Socket.IO client

## 🎯 Key Features

### ✅ Real-time Data Streaming
- Angel One WebSocket integration
- Automatic reconnection on disconnect
- Heartbeat to keep connection alive
- Binary and JSON data parsing

### ✅ Smart Symbol Management
- Filtered dropdown (Exchange → Segment → Symbol)
- Token lookup from database
- Search functionality
- Option chain support

### ✅ Robust Error Handling
- Connection retry logic
- Graceful shutdown
- Error logging
- Health check endpoint

### ✅ No Authentication Required
- Individual project setup
- Direct API access
- No user management needed

## 📝 Next Steps for Frontend

1. **Update Symbol Selection Component:**
   - Use `getExchanges()`, `getSegments()`, `getSymbols()` from `lib/api.ts`
   - Create cascading dropdowns

2. **Integrate WebSocket Hook:**
   - Use `useBackendSocket()` in your components
   - Subscribe to selected symbols
   - Display real-time data in charts

3. **Update Option Chain:**
   - Use `getOptionChain()` to fetch CE/PE data
   - Subscribe to option tokens for live prices
   - Display in option chain table

4. **Premium Charts:**
   - Subscribe to underlying + strike prices
   - Update charts with real-time data from marketData

## ⚠️ Important Notes

- Angel One JWT tokens expire daily - regenerate as needed
- Real-time data only available during market hours (9:15 AM - 3:30 PM IST)
- WebSocket mode 3 (SNAP_QUOTE) provides full market depth
- Database has sample tokens - update with real tokens from Angel One
- No authentication required as this is an individual project

## 🎉 Summary

Your backend is now complete with:
- ✅ MySQL database connection
- ✅ Symbol master data management
- ✅ REST API for queries
- ✅ WebSocket integration with Angel One
- ✅ Socket.IO server for frontend
- ✅ Real-time market data streaming
- ✅ Option chain support
- ✅ Automatic reconnection
- ✅ Health monitoring

**The backend is ready to run! Just setup your MySQL database and start the server.**
