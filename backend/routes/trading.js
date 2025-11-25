const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * GET /api/baskets
 * Get all saved baskets
 */
router.get('/baskets', async (req, res) => {
  try {
    const [baskets] = await pool.query(
      'SELECT * FROM baskets ORDER BY created_at DESC'
    );
    
    // Get positions for each basket
    for (const basket of baskets) {
      const [positions] = await pool.query(
        'SELECT * FROM basket_positions WHERE basket_id = ?',
        [basket.id]
      );
      basket.positions = positions;
    }
    
    res.json({ success: true, data: baskets });
  } catch (error) {
    console.error('Error fetching baskets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/baskets
 * Save a new basket
 */
router.post('/baskets', async (req, res) => {
  try {
    const { name, positions } = req.body;

    if (!name || !positions || positions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Basket name and positions are required' 
      });
    }

    // Create basket
    const [result] = await pool.query(
      'INSERT INTO baskets SET ?',
      {
        name,
        created_at: new Date()
      }
    );

    const basketId = result.insertId;

    // Add positions to basket
    for (const pos of positions) {
      await pool.query(
        'INSERT INTO basket_positions SET ?',
        {
          basket_id: basketId,
          symbol: pos.symbol || 'BANKNIFTY',
          expiry: pos.expiry,
          strike: pos.strike,
          option_type: pos.cepe,
          quantity: pos.qty,
          order_type: pos.type || 'MKT',
          price: pos.price || 0,
          ltp: pos.ltp || 0
        }
      );
    }

    res.json({ 
      success: true, 
      data: { id: basketId, name } 
    });
  } catch (error) {
    console.error('Error saving basket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/baskets/:id
 * Delete a basket
 */
router.delete('/baskets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete basket positions first
    await pool.query('DELETE FROM basket_positions WHERE basket_id = ?', [id]);
    
    // Delete basket
    await pool.query('DELETE FROM baskets WHERE id = ?', [id]);

    res.json({ success: true, message: 'Basket deleted successfully' });
  } catch (error) {
    console.error('Error deleting basket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/baskets/:id/place
 * Place all orders in a basket
 */
router.post('/baskets/:id/place', async (req, res) => {
  try {
    const { id } = req.params;
    const { brokerId, tradingMode } = req.body;

    // Get basket positions
    const [positions] = await pool.query(
      'SELECT * FROM basket_positions WHERE basket_id = ?',
      [id]
    );

    if (!positions || positions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Basket not found or empty' 
      });
    }

    const placedOrders = [];

    for (const pos of positions) {
      // Find symbol in database
      const [symbols] = await pool.query(
        `SELECT * FROM symbols 
         WHERE symbol LIKE ? 
         AND strike_price = ? 
         AND option_type = ?
         LIMIT 1`,
        [`${pos.symbol}%`, pos.strike, pos.option_type]
      );

      if (symbols && symbols.length > 0) {
        const symbol = symbols[0];
        
        // Create order
        const orderData = {
          symbol_id: symbol.symbol_id,
          order_type: pos.order_type === 'LIMIT' ? 'Limit' : 'Market',
          transaction_type: pos.quantity > 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(pos.quantity),
          price: pos.price || null,
          product_type: 'Margin',
          status: 'pending',
          trading_mode: tradingMode || 'paper',
          broker_id: brokerId || null,
          order_timestamp: new Date()
        };

        const [result] = await pool.query('INSERT INTO orders SET ?', orderData);
        placedOrders.push(result.insertId);
      }
    }

    res.json({ 
      success: true, 
      data: { 
        ordersPlaced: placedOrders.length,
        orderIds: placedOrders 
      } 
    });
  } catch (error) {
    console.error('Error placing basket orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/funds
 * Get funds data (consolidated or by broker)
 */
router.get('/funds', async (req, res) => {
  try {
    const { brokerId } = req.query;

    if (brokerId) {
      // Get funds for specific broker
      const [funds] = await pool.query(
        `SELECT 
          available_margin,
          used_margin,
          total_balance,
          realized_pnl,
          unrealized_pnl
        FROM broker_funds
        WHERE broker_id = ?`,
        [brokerId]
      );

      if (funds && funds.length > 0) {
        res.json({ success: true, data: funds[0] });
      } else {
        // Return default paper trading funds
        res.json({ 
          success: true, 
          data: {
            available_margin: 100000,
            used_margin: 0,
            total_balance: 100000,
            realized_pnl: 0,
            unrealized_pnl: 0
          } 
        });
      }
    } else {
      // Return consolidated funds (paper trading default)
      res.json({ 
        success: true, 
        data: {
          available_margin: 100000,
          used_margin: 0,
          total_balance: 100000,
          realized_pnl: 0,
          unrealized_pnl: 0
        } 
      });
    }
  } catch (error) {
    console.error('Error fetching funds:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/holdings
 * Get holdings
 */
router.get('/holdings', async (req, res) => {
  try {
    const { brokerId } = req.query;
    
    let query = `
      SELECT 
        h.*,
        s.symbol as symbol_name
      FROM holdings h
      LEFT JOIN symbols s ON h.symbol_id = s.symbol_id
      WHERE 1=1
    `;
    const params = [];
    
    if (brokerId) {
      query += ' AND h.broker_id = ?';
      params.push(brokerId);
    }
    
    const [holdings] = await pool.query(query, params);
    res.json({ success: true, data: holdings });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/accounts
 * Get account segments
 */
router.get('/accounts', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: [
        { name: 'NSE - Equity' },
        { name: 'NSE - Derivatives' },
        { name: 'BSE - Equity' }
      ] 
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/realized-pnl
 * Get realized P&L
 */
router.get('/realized-pnl', async (req, res) => {
  try {
    const { brokerId } = req.query;
    
    // Calculate from closed positions/trades
    res.json({ 
      success: true, 
      data: { realized_pnl: 0 } 
    });
  } catch (error) {
    console.error('Error fetching realized P&L:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/column-settings/:table
 * Get column settings for a table
 */
router.get('/column-settings/:table', async (req, res) => {
  try {
    const { table } = req.params;
    
    const [settings] = await pool.query(
      'SELECT settings FROM column_settings WHERE table_name = ?',
      [table]
    );

    if (settings && settings.length > 0) {
      res.json({ success: true, data: JSON.parse(settings[0].settings) });
    } else {
      res.json({ success: true, data: {} });
    }
  } catch (error) {
    console.error('Error fetching column settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/column-settings/:table
 * Save column settings
 */
router.post('/column-settings/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const settings = req.body;

    await pool.query(
      `INSERT INTO column_settings (table_name, settings, updated_at) 
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE settings = ?, updated_at = NOW()`,
      [table, JSON.stringify(settings), JSON.stringify(settings)]
    );

    res.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    console.error('Error saving column settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
