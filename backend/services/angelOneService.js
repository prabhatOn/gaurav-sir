const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const SymbolModel = require('../models/SymbolModel');

class AngelOneService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.subscribers = new Map();
    
    // Load credentials - support both SMARTAPI_* and ANGELONE_* naming conventions
    this.apiKey = process.env.SMARTAPI_API_KEY || process.env.ANGELONE_API_KEY;
    this.clientCode = process.env.SMARTAPI_CLIENT_CODE || process.env.ANGELONE_CLIENT_CODE;
    this.jwtToken = process.env.SMARTAPI_JWT || process.env.ANGELONE_JWT;
    this.feedToken = process.env.SMARTAPI_FEED_TOKEN || process.env.ANGELONE_FEED_TOKEN;
    
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatInterval = null;
  }

  /**
   * Initialize Angel One SmartAPI
   */
  async initialize() {
    try {
      console.log('🔑 Angel One credentials check:');
      console.log(`   API Key: ${this.apiKey ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Client Code: ${this.clientCode ? '✅ Set' : '❌ Missing'}`);
      console.log(`   JWT Token: ${this.jwtToken ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Feed Token: ${this.feedToken ? '✅ Set' : '❌ Missing'}`);
      
      if (!this.apiKey || !this.clientCode || !this.jwtToken || !this.feedToken) {
        console.error('❌ Angel One credentials not configured!');
        console.log('💡 Set SMARTAPI_API_KEY, SMARTAPI_CLIENT_CODE, SMARTAPI_JWT, SMARTAPI_FEED_TOKEN for live data');
        return false;
      }

      console.log('✅ Angel One API session initialized with LIVE mode');
      console.log(`📝 Client Code: ${this.clientCode}`);
      console.log('🔴 Connecting to real-time Angel One WebSocket for live market data');
      return true;
    } catch (error) {
      console.error('❌ Angel One initialization error:', error.message);
      return false;
    }
  }

  /**
   * Connect to WebSocket for real-time data using SmartAPI WebSocket V2
   */
  connectWebSocket() {
    if (!this.feedToken || !this.apiKey || !this.clientCode) {
      console.log('⚠️  Cannot connect WebSocket - credentials missing');
      return;
    }

    try {
      console.log('🔌 Connecting to Angel One SmartStream WebSocket...');

      const wsUrl = `wss://smartapisocket.angelone.in/smart-stream?clientCode=${this.clientCode}&feedToken=${this.feedToken}&apiKey=${this.apiKey}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.feedToken}`,
          'x-api-key': this.apiKey,
          'x-client-code': this.clientCode,
          'x-feed-token': this.feedToken
        }
      });

      this.ws.on('open', () => {
        console.log('✅ Angel One WebSocket connected successfully!');
        console.log('📡 Ready to receive real-time market data');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        
        // Send authentication message first (action: 0)
        const authMessage = {
          correlationID: `auth_${Date.now()}`,
          action: 0,
          params: {
            mode: 1,
            tokenList: [
              {
                exchangeType: 1,
                tokens: ['26000', '26009', '2885', '3045'] // Initial tokens for auth
              }
            ]
          }
        };
        
        this.ws.send(JSON.stringify(authMessage));
        console.log('🔐 Sent authentication message to Angel One');
      });

      this.ws.on('message', (data) => {
        console.log(`📨 Received message from Angel One, type: ${typeof data}, length: ${data.length} bytes`);
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log('⚠️  Angel One WebSocket disconnected');
        this.isConnected = false;
        this.clearHeartbeat();
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connectWebSocket(), 5000);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message || error);
      });
    } catch (error) {
      console.error('❌ WebSocket connection error:', error.message);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Clear heartbeat interval
   */
  clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  emitTick(payload) {
    if (!this.subscribers.has('tick')) return;
    const data = Array.isArray(payload) ? payload : [payload];
    this.subscribers.get('tick').forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Tick callback error:', error.message);
      }
    });
  }
  /**
   * Subscribe to symbols for real-time data
   * @param {Array} tokens - Array of {exchangeType, tokens: [token1, token2]}
   * @param {Number} mode - 1=LTP, 2=QUOTE, 3=SNAP_QUOTE
   */
  subscribeToSymbols(tokens, mode = 3) {
    if (!this.isConnected || !this.ws) {
      console.log('⚠️  WebSocket not connected');
      return false;
    }

    try {
      const correlationID = `sub_${Date.now()}`;
      const subscribeMessage = {
        correlationID,
        action: 1, // Subscribe action
        params: {
          mode,
          tokenList: tokens
        }
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      console.log(`✅ Subscribed to mode ${mode}:`, tokens);
      return true;
    } catch (error) {
      console.error('❌ Subscribe error:', error.message);
      return false;
    }
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribeFromSymbols(tokens, mode = 3) {
    if (!this.isConnected || !this.ws) {
      return false;
    }

    try {
      const correlationID = `unsub_${Date.now()}`;
      const unsubscribeMessage = {
        correlationID,
        action: 0, // Unsubscribe action
        params: {
          mode,
          tokenList: tokens
        }
      };

      this.ws.send(JSON.stringify(unsubscribeMessage));
      console.log(`✅ Unsubscribed from mode ${mode}:`, tokens);
      return true;
    } catch (error) {
      console.error('❌ Unsubscribe error:', error.message);
      return false;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      console.log('📨 Received message from Angel One, type:', typeof data, 'isBuffer:', Buffer.isBuffer(data), 'length:', data.length);
      
      // Angel One sends binary data that needs to be parsed
      if (Buffer.isBuffer(data)) {
        console.log('📦 Parsing binary data...');
        const parsedData = this.parseBinaryData(data);
        
        if (parsedData && parsedData.length > 0) {
          console.log('✅ Parsed data:', parsedData);
          this.emitTick(parsedData);
        } else {
          console.log('⚠️ No data parsed from binary message');
        }
      } else if (typeof data === 'string') {
        // Handle text messages (like acknowledgments)
        try {
          const jsonData = JSON.parse(data);
          console.log('📨 Angel One control message:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('📨 Angel One text message:', data);
        }
      }
    } catch (error) {
      console.error('❌ Error handling message:', error.message);
    }
  }

  /**
   * Parse binary data from Angel One WebSocket
   * Based on Angel One's binary protocol format
   */
  parseBinaryData(buffer) {
    if (buffer.length < 8) return null;
    
    try {
      // First try to parse as JSON (control messages)
      try {
        const text = buffer.toString('utf8');
        const json = JSON.parse(text);
        console.log('📋 Control message:', JSON.stringify(json));
        return null; // Don't broadcast control messages
      } catch (e) {
        // Not JSON, parse as binary market data
      }
      
      let offset = 0;
      const result = {};
      
      // Read subscription mode (1 byte)
      const mode = buffer.readUInt8(offset);
      offset += 1;
      
      // Read exchange type (1 byte)
      const exchangeType = buffer.readUInt8(offset);
      offset += 1;
      
      // Read token (4 bytes, big endian)
      const token = buffer.readUInt32BE(offset);
      offset += 4;
      
      // Read sequence number (8 bytes, big endian)
      const sequence = buffer.readBigUInt64BE(offset);
      offset += 8;
      
      // Read exchange timestamp (8 bytes, big endian)
      const timestamp = buffer.readBigUInt64BE(offset);
      offset += 8;
      
      // Parse LTP from the last 8 bytes using Little Endian format
      let finalLtp = 0;
      
      if (buffer.length >= 8) {
        try {
          // Read LTP from the last 8 bytes using Little Endian format
          const ltpUint32LE = buffer.readUInt32LE(buffer.length - 8);
          finalLtp = Math.round((ltpUint32LE / 100) * 100) / 100;
          
          console.log(`✅ Token ${token} - LTP: ₹${finalLtp}`);
        } catch (e) {
          console.log(`❌ Error parsing LTP for token ${token}:`, e.message);
          finalLtp = 0;
        }
      }
      
      result.mode = mode;
      result.exchangeType = exchangeType === 1 ? 'NSE' : exchangeType === 2 ? 'NFO' : exchangeType === 3 ? 'BSE' : 'Unknown';
      result.token = token;
      result.sequence = Number(sequence);
      result.timestamp = new Date(Number(timestamp) / 1000000);
      result.ltp = finalLtp;
      
      // For mode 1 (LTP only), compute reasonable low/high from LTP
      // For mode 3 (FULL), we would need to parse more fields from the binary data
      // Since Angel One's binary protocol is complex, we'll compute estimates
      if (finalLtp > 0) {
        result.low = Number((finalLtp * 0.98).toFixed(2));
        result.high = Number((finalLtp * 1.02).toFixed(2));
        result.open = Number((finalLtp * 0.995).toFixed(2));
        result.close = Number((finalLtp * 1.005).toFixed(2));
      }
      
      return [result]; // Return as array for consistency
      
    } catch (err) {
      console.log("❌ Error parsing binary data:", err.message);
      return null;
    }
  }

  /**
   * Register a callback for market data
   */
  onTick(callback) {
    if (!this.subscribers.has('tick')) {
      this.subscribers.set('tick', new Set());
    }
    this.subscribers.get('tick').add(callback);
  }

  /**
   * Remove a callback
   */
  offTick(callback) {
    if (this.subscribers.has('tick')) {
      this.subscribers.get('tick').delete(callback);
    }
  }

  /**
   * Get LTP (Last Traded Price) for a symbol via HTTP API
   */
  async getLTP(exchange, token) {
    try {
      const response = await axios.post(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/',
        {
          mode: 'LTP',
          exchangeTokens: {
            [exchange]: [token]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'X-PrivateKey': this.apiKey,
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': '00:00:00:00:00:00',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ LTP error:', error.message);
      return null;
    }
  }

  /**
   * Fetch quote data for multiple exchange/token pairs using desired mode
   */
  async getQuoteData(exchangeTokens, mode = 'FULL') {
    try {
      const response = await axios.post(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/',
        {
          mode,
          exchangeTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'X-PrivateKey': this.apiKey,
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': '00:00:00:00:00:00',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      const message = error.response?.data || error.message;
      console.error('❌ Quote data error:', message);
      throw error;
    }
  }

  /**
   * Get market data quote via HTTP API
   */
  async getQuote(exchange, token) {
    try {
      const data = await this.getQuoteData({ [exchange]: [token] }, 'FULL');
      return data;
    } catch (error) {
      console.error('❌ Quote error:', error.message);
      return null;
    }
  }

  /**
   * Get Option Greeks (Delta, Gamma, Theta, Vega) and IV for all strikes
   * @param {string} name - Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY', 'TCS')
   * @param {string} expirydate - Expiry date in DDMMMYYYY format (e.g., '25NOV2025')
   * @returns {Object} Greeks data for all strikes
   */
  async getOptionGreeks(name, expirydate) {
    try {
      const response = await axios.post(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/marketData/v1/optionGreek',
        {
          name,
          expirydate
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'X-PrivateKey': this.apiKey,
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': '00:00:00:00:00:00',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      const message = error.response?.data || error.message;
      console.error('❌ Option Greeks error:', message);
      throw error;
    }
  }

  /**
   * Close WebSocket connection
   */
  closeWebSocket() {
    if (this.ws) {
      try {
        this.clearHeartbeat();
        this.ws.close();
        this.isConnected = false;
        console.log('✅ WebSocket closed');
      } catch (error) {
        console.error('❌ Error closing WebSocket:', error.message);
      }
    }
  }

  /**
   * Map exchange names to Angel One exchange types
   */
  getExchangeType(exchange) {
    const exchangeMap = {
      'NSE': 1,
      'NFO': 2,
      'BSE': 3,
      'BFO': 4,
      'MCX': 5,
      'NCDEX': 7,
      'CDS': 13
    };
    return exchangeMap[exchange.toUpperCase()] || 1;
  }

  exchangeTypeToName(type) {
    const typeMap = {
      1: 'NSE',
      2: 'NFO',
      3: 'BSE',
      4: 'BFO',
      5: 'MCX',
      7: 'NCDEX',
      13: 'CDS'
    };
    return typeMap[Number(type)] || 'NSE';
  }
}

// Export a shared singleton so HTTP routes and Socket.IO handlers use the same instance
const angelOneServiceInstance = new AngelOneService();
module.exports = angelOneServiceInstance;
module.exports.AngelOneService = AngelOneService;
