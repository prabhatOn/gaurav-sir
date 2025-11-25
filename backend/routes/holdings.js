const express = require('express');
const router = express.Router();

/**
 * GET /api/holdings
 * Get user holdings
 */
router.get('/holdings', async (req, res) => {
  try {
    const { tradingMode } = req.query;
    
    // Return empty holdings for now
    const holdings = [];
    
    res.json({ success: true, data: holdings });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
