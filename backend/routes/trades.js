const express = require('express');
const router = express.Router();

/**
 * GET /api/trades
 * Get trade book (executed trades)
 */
router.get('/trades', async (req, res) => {
  try {
    const { tradingMode } = req.query;
    
    // Return empty trades for now
    const trades = [];
    
    res.json({ success: true, data: trades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
