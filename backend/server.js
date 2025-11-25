const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config({ path: '../.env.local' });

const { testConnection } = require('./config/database');
const angelOneService = require('./services/angelOneService');
const apiRoutes = require('./routes/api');
const ordersRoutes = require('./routes/orders');
const positionsRoutes = require('./routes/positions');
const brokersRoutes = require('./routes/brokers');
const tradingRoutes = require('./routes/trading');
const symbolsRoutes = require('./routes/symbols');
const holdingsRoutes = require('./routes/holdings');
const tradesRoutes = require('./routes/trades');
const fundsRoutes = require('./routes/funds');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Socket.IO
const io = socketIo(server, {
  cors: corsOptions
});

// API routes
app.use('/api', apiRoutes);
app.use('/api', ordersRoutes);
app.use('/api', positionsRoutes);
app.use('/api', brokersRoutes);
app.use('/api', tradingRoutes);
app.use('/api', symbolsRoutes);
app.use('/api', holdingsRoutes);
app.use('/api', tradesRoutes);
app.use('/api', fundsRoutes);

// Store active subscriptions
const activeSubscriptions = new Map(); // socketId -> Set of tokens
const tokenSymbolMap = new Map(); // 'exchange:token' -> custom symbol name

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // Initialize subscription set for this client
  activeSubscriptions.set(socket.id, new Set());

  /**
   * Subscribe to real-time market data
   * Data format: { tokens: [{ exchange: "NSE", token: "3045" }], mode: 3 }
   * OR { brokerId: 'market', tokens: ['26000', '26009'], updateInterval: 5 }
   */
  socket.on('subscribe', (data) => {
    console.log(`📡 Subscribe request from ${socket.id}:`, data);
    
    try {
      const { tokens, mode = 3 } = data;
      
      if (!tokens || !Array.isArray(tokens)) {
        socket.emit('error', { message: 'Invalid tokens format' });
        return;
      }

      // Add to active subscriptions
      tokens.forEach(({ exchange, token }) => {
        activeSubscriptions.get(socket.id).add(`${exchange}:${token}`);
      });

      // Subscribe to Angel One WebSocket
      angelOneService.subscribeToSymbols(tokens, mode);
      
      socket.emit('subscribed', { 
        message: 'Successfully subscribed',
        tokens 
      });
      
    } catch (error) {
      console.error('Subscribe error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Subscribe to positions/market data (alternative event name used by frontend)
   */
  socket.on('subscribePositions', (data) => {
    console.log(`📡 SubscribePositions request from ${socket.id}:`, data);
    
    try {
      const { tokens = [], brokerId, updateInterval } = data;
      
      if (tokens.length === 0) {
        console.log(`📝 No tokens to subscribe for ${socket.id}`);
        return;
      }

      // Convert token strings to the format Angel One expects
      const tokensByExchange = {};
      
      tokens.forEach(token => {
        let exchange = 'NSE';
        let tokenValue = token;
        let customSymbol = null;
        
        // If already an object with exchange and token
        if (typeof token === 'object' && token.exchange && token.token) {
          exchange = token.exchange;
          tokenValue = token.token;
          customSymbol = token.symbol || token.symbolName; // Store custom display name
        }
        
        // Group tokens by exchange
        if (!tokensByExchange[exchange]) {
          tokensByExchange[exchange] = [];
        }
        tokensByExchange[exchange].push(String(tokenValue));
        
        // Add to active subscriptions
        const key = `${exchange}:${tokenValue}`;
        activeSubscriptions.get(socket.id).add(key);
        
        // Store custom symbol name for this token
        if (customSymbol) {
          tokenSymbolMap.set(key, customSymbol);
          console.log(`📝 Mapped ${key} -> ${customSymbol}`);
        }
      });

      // Convert to Angel One format: [{ exchangeType: 1, tokens: ['26000', '26009'] }]
      const angelOneFormat = Object.entries(tokensByExchange).map(([exchange, tokenList]) => ({
        exchangeType: angelOneService.getExchangeType(exchange),
        tokens: tokenList
      }));

      // Subscribe to Angel One WebSocket with mode 3 (FULL) to get low, high, open, close, volume, etc.
      angelOneService.subscribeToSymbols(angelOneFormat, 3); // mode 3 = FULL data
      
      console.log(`✅ Subscribed ${socket.id} to ${tokens.length} tokens:`, angelOneFormat);
      
    } catch (error) {
      console.error('SubscribePositions error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Unsubscribe from market data
   */
  socket.on('unsubscribe', (data) => {
    console.log(`📴 Unsubscribe request from ${socket.id}:`, data);
    
    try {
      const { tokens } = data;
      
      if (!tokens || !Array.isArray(tokens)) {
        socket.emit('error', { message: 'Invalid tokens format' });
        return;
      }

      // Remove from active subscriptions
      const clientSubs = activeSubscriptions.get(socket.id);
      tokens.forEach(({ exchange, token }) => {
        clientSubs.delete(`${exchange}:${token}`);
      });

      // Check if any other client is still subscribed
      const stillNeeded = Array.from(activeSubscriptions.values())
        .some(subs => tokens.some(t => subs.has(`${t.exchange}:${t.token}`)));

      if (!stillNeeded) {
        angelOneService.unsubscribeFromSymbols(tokens);
      }
      
      socket.emit('unsubscribed', { 
        message: 'Successfully unsubscribed',
        tokens 
      });
      
    } catch (error) {
      console.error('Unsubscribe error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Get current subscription status
   */
  socket.on('getSubscriptions', () => {
    const subs = Array.from(activeSubscriptions.get(socket.id) || []);
    socket.emit('subscriptions', { subscriptions: subs });
  });

  /**
   * Client disconnection
   */
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    
    // Clean up subscriptions
    const clientSubs = activeSubscriptions.get(socket.id);
    if (clientSubs) {
      // Check if tokens are still needed by other clients
      const tokensToUnsubscribe = Array.from(clientSubs)
        .map(sub => {
          const [exchange, token] = sub.split(':');
          return { exchange, token };
        })
        .filter(({ exchange, token }) => {
          return !Array.from(activeSubscriptions.entries())
            .filter(([id]) => id !== socket.id)
            .some(([, subs]) => subs.has(`${exchange}:${token}`));
        });

      if (tokensToUnsubscribe.length > 0) {
        angelOneService.unsubscribeFromSymbols(tokensToUnsubscribe);
      }

      activeSubscriptions.delete(socket.id);
    }
  });
});

// Add Angel One subscriber to broadcast to Socket.IO clients
angelOneService.onTick(async (data) => {
  try {
    // Broadcast market data to all connected clients
    const positions = Array.isArray(data) ? data : [data];
    
    // Enrich data with symbol names from database
    const enrichedPositions = await Promise.all(
      positions.map(async (pos) => {
        try {
          const exchange = pos.exchange || pos.exchangeType || 'NSE';
          const tokenKey = `${exchange}:${pos.token}`;
          const customSymbol = tokenSymbolMap.get(tokenKey);
          
          // If we have a custom symbol from subscription, use it
          if (customSymbol) {
            return {
              ...pos,
              symbol: customSymbol,
              symbolName: customSymbol,
              name: customSymbol,
              exchange,
              low: pos.low,
              high: pos.high,
              open: pos.open,
              close: pos.close
            };
          }
          
          // Otherwise, try to fetch from database
          const SymbolModel = require('./models/SymbolModel');
          const symbolData = await SymbolModel.getSymbolByToken(String(pos.token), exchange);
          
          return {
            ...pos,
            symbol: symbolData?.symbol || `Token_${pos.token}`,
            symbolName: symbolData?.name || symbolData?.symbol || `Token_${pos.token}`,
            name: symbolData?.name || symbolData?.symbol || `Token_${pos.token}`,
            lot_size: symbolData?.lot_size || 1,
            exchange
          };
        } catch (e) {
          return {
            ...pos,
            symbol: `Token_${pos.token}`,
            symbolName: `Token_${pos.token}`,
            name: `Token_${pos.token}`
          };
        }
      })
    );
    
    // Frontend expects 'positionUpdate' event with positions array
    io.emit('marketData', enrichedPositions);
    io.emit('positionUpdate', { positions: enrichedPositions });
    
    // Log detailed info for first position to debug
    if (enrichedPositions.length > 0) {
      const first = enrichedPositions[0];
      console.log(`📡 Sample broadcast data: symbol="${first.symbol}" token=${first.token} ltp=${first.ltp} low=${first.low} high=${first.high}`);
    }
    console.log(`📡 Broadcast ${enrichedPositions.length} market updates to ${io.engine.clientsCount} clients`);
  } catch (error) {
    console.error('❌ Error broadcasting market data:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  angelOneService.closeWebSocket();
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown');
    process.exit(1);
  }, 10000);
}

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize Angel One service
    const angelInitialized = await angelOneService.initialize();
    if (!angelInitialized) {
      console.warn('⚠️ Angel One service initialization failed. WebSocket features may not work.');
    } else {
      // Connect to Angel One WebSocket
      angelOneService.connectWebSocket();
    }

    // Start Express server
    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
      console.log(`🌐 API endpoint: http://localhost:${PORT}/api`);
      console.log(`\n✅ Ready to accept connections\n`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
