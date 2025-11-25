const express = require('express');
const router = express.Router();

/**
 * GET /api/funds
 * Get available funds/margins
 */
router.get('/funds', async (req, res) => {
  try {
    const { tradingMode } = req.query;
    
    // Return mock funds data
    const funds = {
      availableBalance: 100000,
      usedMargin: 0,
      availableMargin: 100000,
      collateral: 0
    };
    
    res.json({ success: true, data: funds });
  } catch (error) {
    console.error('Error fetching funds:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
