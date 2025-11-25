const express = require('express');
const router = express.Router();
const SymbolModel = require('../models/SymbolModel');

/**
 * GET /api/symbols/:symbol/option-contracts
 * Get option contract details (CE/PE) for a symbol, expiry, and strike
 * Query params: expiry, strike
 * 
 * Note: Other symbol routes (/symbols/:symbol, /symbols/:symbol/expiries, 
 * /symbols/:symbol/expiries/:expiry/strikes) are defined in api.js
 */
router.get('/symbols/:symbol/option-contracts', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { expiry, strike } = req.query;
    
    if (!expiry || !strike) {
      return res.status(400).json({ 
        success: false, 
        error: 'expiry and strike are required' 
      });
    }

    // Get CE and PE contracts
    const contracts = await SymbolModel.getOptionContracts(symbol, expiry, strike);
    
    res.json({ success: true, status: true, data: contracts });
  } catch (error) {
    console.error('Error fetching option contracts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
