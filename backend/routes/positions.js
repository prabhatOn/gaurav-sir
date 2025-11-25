const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * GET /api/positions
 * Get all positions, optionally filtered by broker and trading mode
 */
router.get('/positions', async (req, res) => {
  try {
    const { brokerId, tradingMode } = req.query;
    
    let query = `
      SELECT 
        p.*,
        s.symbol as symbol_name,
        s.name as symbol_full_name,
        s.token,
        s.exchange as symbol_exchange,
        b.name as broker_name
      FROM positions p
      LEFT JOIN symbols s ON p.symbol_id = s.id
      LEFT JOIN brokers b ON p.broker_id = b.id
      WHERE p.quantity != 0
    `;
    const params = [];
    
    // Filter by trading mode (default to paper if not specified)
    if (tradingMode) {
      query += ' AND p.trading_mode = ?';
      params.push(tradingMode);
    }
    
    if (brokerId) {
      query += ' AND p.broker_id = ?';
      params.push(brokerId);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    console.log('Fetching positions with filters:', { tradingMode, brokerId });
    const [positions] = await pool.query(query, params);
    console.log(`Found ${positions.length} positions`);
    
    // Calculate P&L for each position
    const enrichedPositions = positions.map(pos => ({
      ...pos,
      pnl: 0, // Will be calculated with real-time LTP
      unrealised: 0,
      realised: pos.realized_pnl || 0
    }));
    
    res.json({ success: true, status: true, data: enrichedPositions });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ success: false, status: false, error: error.message });
  }
});

/**
 * POST /api/positions/close
 * Close a specific position
 */
router.post('/positions/close', async (req, res) => {
  try {
    const { positionId, price } = req.body;

    // Get position details
    const [positions] = await pool.query(
      'SELECT * FROM positions WHERE id = ?',
      [positionId]
    );

    if (!positions || positions.length === 0) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }

    const position = positions[0];

    // Create closing order
    const orderData = {
      symbol_id: position.symbol_id,
      order_type: 'Market',
      transaction_type: position.quantity > 0 ? 'SELL' : 'BUY',
      quantity: Math.abs(position.quantity),
      price: price || null,
      status: 'executed',
      executed_at: new Date(),
      trading_mode: position.trading_mode,
      broker_id: position.broker_id
    };

    await pool.query('INSERT INTO orders SET ?', orderData);

    // Update position to zero
    await pool.query(
      'UPDATE positions SET quantity = 0, updated_at = NOW() WHERE id = ?',
      [positionId]
    );

    res.json({ success: true, message: 'Position closed successfully' });
  } catch (error) {
    console.error('Error closing position:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/positions/close-all
 * Close all positions
 */
router.post('/positions/close-all', async (req, res) => {
  try {
    const { brokerId } = req.body;
    
    let query = 'SELECT * FROM positions WHERE quantity != 0';
    const params = [];
    
    if (brokerId) {
      query += ' AND broker_id = ?';
      params.push(brokerId);
    }

    const [positions] = await pool.query(query, params);

    for (const position of positions) {
      // Create closing orders
      await pool.query(
        'INSERT INTO orders SET ?',
        {
          symbol_id: position.symbol_id,
          order_type: 'Market',
          transaction_type: position.quantity > 0 ? 'SELL' : 'BUY',
          quantity: Math.abs(position.quantity),
          status: 'executed',
          executed_at: new Date(),
          trading_mode: position.trading_mode,
          broker_id: position.broker_id
        }
      );

      // Zero out position
      await pool.query(
        'UPDATE positions SET quantity = 0, updated_at = NOW() WHERE id = ?',
        [position.id]
      );
    }

    res.json({ 
      success: true, 
      message: `Closed ${positions.length} positions` 
    });
  } catch (error) {
    console.error('Error closing all positions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/trades
 * Get all executed trades
 */
router.get('/trades', async (req, res) => {
  try {
    const { brokerId } = req.query;
    
    let query = `
      SELECT 
        o.*,
        s.symbol as symbol_name,
        s.name as symbol_full_name
      FROM orders o
      LEFT JOIN symbols s ON o.symbol_id = s.symbol_id
      WHERE o.status = 'executed'
    `;
    const params = [];
    
    if (brokerId) {
      query += ' AND o.broker_id = ?';
      params.push(brokerId);
    }
    
    query += ' ORDER BY o.executed_at DESC';
    
    const [trades] = await pool.query(query, params);
    res.json({ success: true, data: trades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
