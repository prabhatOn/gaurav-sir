# Backend Setup Complete! 🎉

## ✅ What's Been Created

### Backend Structure
```
backend/
├── config/
│   └── database.js          # MySQL connection pool
├── models/
│   └── SymbolModel.js       # Database model for symbols
├── routes/
│   └── api.js               # REST API endpoints
├── services/
│   └── angelOneService.js   # Angel One WebSocket service
├── database/
│   └── schema.sql           # Database schema
├── server.js                # Main server file
├── package.json             # Dependencies
└── README.md                # Documentation
```

### Frontend Integration
```
lib/
└── api.ts                   # API utility functions

hooks/
└── use-backend-socket.tsx   # Socket.IO hook for real-time data
```

## 📋 Next Steps

### 1. Setup Database
Import the schema into your MySQL database:
```bash
mysql -u root -p
```
Then in MySQL:
```sql
source B:/projects/gaurav-new/backend/database/schema.sql
```

Or use phpMyAdmin to import `backend/database/schema.sql`

### 2. Configure Environment
The `.env.example` has been updated with database credentials. Copy it to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Start Backend Server
```bash
cd backend
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Server will run on: http://localhost:5000

### 4. Test the API
Health check:
```bash
curl http://localhost:5000/api/health
```

Get exchanges:
```bash
curl http://localhost:5000/api/exchanges
```

## 🔄 Data Flow

```
1. User selects Exchange → GET /api/exchanges
   ↓
2. User selects Segment → GET /api/segments?exchange=NSE
   ↓
3. User selects Symbol → GET /api/symbols?exchange=NSE&segment=EQ
   ↓
4. Get symbol token from DB
   ↓
5. Subscribe to WebSocket → socket.emit('subscribe', {...})
   ↓
6. Receive real-time data → socket.on('marketData', ...)
   ↓
7. Display in charts (CE/PE/Current)
   ↓
8. Option chain with live prices
```

## 🛠️ API Endpoints Available

- `GET /api/exchanges` - Get all exchanges
- `GET /api/segments?exchange=NSE` - Get segments
- `GET /api/symbols?exchange=NSE&segment=EQ` - Get symbols
- `GET /api/symbol/:symbol?exchange=NSE` - Get token
- `POST /api/quote` - Get full quote data
- `POST /api/search` - Search symbols
- `GET /api/option-chain/:underlying` - Get option chain
- `GET /api/health` - Health check

## 🔌 WebSocket Events

**Subscribe to market data:**
```javascript
socket.emit('subscribe', {
  tokens: [
    { exchange: "NSE", token: "3045" },
    { exchange: "NFO", token: "58662" }
  ],
  mode: 3  // 1=LTP, 2=QUOTE, 3=SNAP_QUOTE
});
```

**Receive data:**
```javascript
socket.on('marketData', (data) => {
  console.log(data);
});
```

## 📝 Notes

- Database credentials in `.env.local`: 
  - DB_HOST=localhost
  - DB_USER=root
  - DB_PASSWORD=(empty)
  - DB_NAME=trading_demo

- Angel One credentials are already in `.env.example`

- No authentication needed (individual project)

- WebSocket auto-reconnects on disconnect

- Real-time data only during market hours

## 🚨 Important

Make sure MySQL is running and the `trading_demo` database is created before starting the backend server!
