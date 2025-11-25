const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * GET /api/orders
 * Get all orders, optionally filtered by broker
 */
router.get('/orders', async (req, res) => {
  try {
    const { brokerId } = req.query;
    
    let query = `
      SELECT 
        o.*,
        s.symbol as symbol_name,
        s.name as symbol_full_name
      FROM orders o
      LEFT JOIN symbols s ON o.symbol_id = s.symbol_id
      WHERE 1=1
    `;
    const params = [];
    
    if (brokerId) {
      query += ' AND o.broker_id = ?';
      params.push(brokerId);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    const [orders] = await pool.query(query, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/orders
 * Place a new order (paper trading or live)
 */
router.post('/orders', async (req, res) => {
  try {
    const {
      symbol,
      order_type,
      transaction_type,
      quantity,
      price,
      trigger_price,
      market_protection_percentage,
      product_type,
      predefined_sl,
      target_price,
      tradingMode,
      brokerId
    } = req.body;

    // Get symbol details
    const [symbols] = await pool.query(
      'SELECT * FROM symbols WHERE symbol = ? LIMIT 1',
      [symbol]
    );

    if (!symbols || symbols.length === 0) {
      return res.status(404).json({ success: false, error: 'Symbol not found' });
    }

    const symbolData = symbols[0];

    // For paper trading, insert into local database
    if (tradingMode === 'paper' || !brokerId) {
      // Calculate execution price for market protection orders
      let executionPrice = price;
      if (order_type === 'MARKET_PROTECTION' && market_protection_percentage) {
        const ltp = symbolData.ltp || symbolData.close || 0;
        const protectionMultiplier = transaction_type === 'BUY' 
          ? 1 + (market_protection_percentage / 100)
          : 1 - (market_protection_percentage / 100);
        executionPrice = ltp * protectionMultiplier;
      }

      const orderData = {
        symbol_id: symbolData.symbol_id,
        order_type: order_type || 'MARKET',
        transaction_type: transaction_type || 'BUY',
        quantity: quantity || 1,
        price: executionPrice || null,
        trigger_price: trigger_price || null,
        product_type: product_type || 'INTRADAY',
        status: 'pending',
        order_timestamp: new Date(),
        trading_mode: 'paper'
      };

      const [result] = await pool.query('INSERT INTO orders SET ?', orderData);
      
      // Simulate execution for market orders in paper mode
      const shouldExecuteImmediately = ['MARKET', 'MARKET_PROTECTION'].includes(order_type);
      if (shouldExecuteImmediately) {
        const finalPrice = executionPrice || symbolData.ltp || symbolData.close || 0;
        
        await pool.query(
          'UPDATE orders SET status = ?, executed_at = NOW(), price = ? WHERE id = ?',
          ['executed', finalPrice, result.insertId]
        );

        // Create position
        await createOrUpdatePosition({
          symbol_id: symbolData.symbol_id,
          symbol: symbolData.symbol,
          quantity: transaction_type === 'BUY' ? quantity : -quantity,
          average_price: finalPrice,
          trading_mode: 'paper'
        });

        // If predefined SL/Target is enabled, create additional orders
        if (predefined_sl && target_price) {
          const slOrderData = {
            symbol_id: symbolData.symbol_id,
            order_type: 'STOPLOSS_MARKET',
            transaction_type: transaction_type === 'BUY' ? 'SELL' : 'BUY',
            quantity: quantity,
            trigger_price: finalPrice - target_price, // Assuming target_price is points away
            product_type: product_type,
            status: 'pending',
            order_timestamp: new Date(),
            trading_mode: 'paper'
          };
          await pool.query('INSERT INTO orders SET ?', slOrderData);
        }
      }

      res.json({ 
        success: true, 
        data: { 
          id: result.insertId, 
          status: shouldExecuteImmediately ? 'executed' : 'pending',
          executionPrice: shouldExecuteImmediately ? (executionPrice || symbolData.ltp) : null
        } 
      });
    } else {
      // For live trading, place order with broker
      // This would call the broker's API
      res.status(501).json({ 
        success: false, 
        error: 'Live broker integration not yet implemented in this endpoint' 
      });
    }
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/orders/:orderId
 * Cancel an order
 */
router.delete('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    await pool.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      ['cancelled', orderId]
    );

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/orders/cancel-all
 * Cancel all pending orders
 */
router.post('/orders/cancel-all', async (req, res) => {
  try {
    const { brokerId } = req.body;
    
    let query = 'UPDATE orders SET status = ?, updated_at = NOW() WHERE status = ?';
    const params = ['cancelled', 'pending'];
    
    if (brokerId) {
      query += ' AND broker_id = ?';
      params.push(brokerId);
    }

    const [result] = await pool.query(query, params);

    res.json({ 
      success: true, 
      message: `Cancelled ${result.affectedRows} orders` 
    });
  } catch (error) {
    console.error('Error cancelling all orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper function to create or update position
 */
async function createOrUpdatePosition(data) {
  const { symbol_id, quantity, average_price, trading_mode, broker_id } = data;

  // Check if position exists
  let query = 'SELECT * FROM positions WHERE symbol_id = ? AND trading_mode = ?';
  const params = [symbol_id, trading_mode];

  if (broker_id) {
    query += ' AND broker_id = ?';
    params.push(broker_id);
  } else {
    query += ' AND broker_id IS NULL';
  }

  const [existing] = await pool.query(query, params);

  if (existing && existing.length > 0) {
    // Update existing position
    const pos = existing[0];
    const newQty = pos.quantity + quantity;
    const newAvgPrice = ((pos.average_price * pos.quantity) + (average_price * quantity)) / newQty;

    await pool.query(
      'UPDATE positions SET quantity = ?, average_price = ?, updated_at = NOW() WHERE id = ?',
      [newQty, newAvgPrice, pos.id]
    );
  } else {
    // Create new position
    await pool.query(
      'INSERT INTO positions SET ?',
      {
        symbol_id,
        quantity,
        average_price,
        trading_mode,
        broker_id: broker_id || null,
        created_at: new Date()
      }
    );
  }
}

module.exports = router;
