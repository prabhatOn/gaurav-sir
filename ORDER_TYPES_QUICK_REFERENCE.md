# Order Types Implementation - Quick Reference

## ✅ FULLY IMPLEMENTED FEATURES

### Order Types (All Working)
```
┌─────────────────────────────────────────────────────────────┐
│  ORDER TYPES                                                │
├─────────────────────────────────────────────────────────────┤
│  [🟢 LIMIT]  [🟢 MARKET]  [🟢 MARKET PROTECTION]           │
│  [🟢 SL-M]   [🟢 SL-L]                                      │
└─────────────────────────────────────────────────────────────┘
```

### Product Types (All Working)
```
┌─────────────────────────────────────────────────────────────┐
│  PRODUCT TYPES                                              │
├─────────────────────────────────────────────────────────────┤
│  [🟢 MARGIN]  [🟢 INTRADAY]                                 │
└─────────────────────────────────────────────────────────────┘
```

## Order Type Details

### 1. LIMIT Order
```
User Action:  Click [LIMIT] button
Fields Show:  • Limit Price (required)
Execution:    When market reaches specified price
Status:       PENDING → EXECUTED (when price met)
Use Case:     Buy at specific price or better
```

### 2. MARKET Order
```
User Action:  Click [MARKET] button
Fields Show:  (none - uses LTP)
Execution:    Immediate at current market price
Status:       EXECUTED immediately
Use Case:     Quick entry/exit at current price
```

### 3. MARKET PROTECTION Order
```
User Action:  Click [MARKET PROTECTION] button
Fields Show:  • Protection % (default 5%)
Execution:    Immediate at protected price
Calculation:  BUY:  LTP × (1 + protection%)
              SELL: LTP × (1 - protection%)
Status:       EXECUTED immediately
Use Case:     Market order with slippage protection
Example:      LTP=26000, Protection=5%
              → Buy at max 27,300
              → Sell at min 24,700
```

### 4. SL-M (Stop Loss Market)
```
User Action:  Click [SL-M] button
Fields Show:  • Trigger Price (required)
Execution:    Market order when trigger hit
Status:       PENDING → MARKET → EXECUTED
Use Case:     Stop loss with market execution
Example:      Long position at 26000
              Set SL-M trigger at 25800
              → Exits at market when price hits 25800
```

### 5. SL-L (Stop Loss Limit)
```
User Action:  Click [SL-L] button
Fields Show:  • Trigger Price (required)
              • Limit Price (required)
Execution:    Limit order when trigger hit
Status:       PENDING → LIMIT → EXECUTED (if limit met)
Use Case:     Stop loss with price control
Example:      Long position at 26000
              Trigger: 25800
              Limit: 25700
              → Places limit order at 25700 when price hits 25800
Warning:      May not execute if market gaps below limit
```

## Product Types

### MARGIN (Delivery/Carryforward)
```
Purpose:      Hold positions overnight
Margin:       Full margin required
Auto-Square:  NO (manual exit required)
Duration:     Multiple days allowed
Backend:      DELIVERY
```

### INTRADAY (MIS)
```
Purpose:      Intraday trading only
Margin:       Lower margin (leverage allowed)
Auto-Square:  YES (end of day)
Duration:     Same day only
Backend:      INTRADAY
```

## Additional Features

### Predefined Stop Loss
```
Enable:       ✅ Checkbox "Predefined SL"
Input:        Target Price (in points)
Behavior:     Auto-creates SL order when main order executes
Example:      Buy at 26000 with 100 point SL
              → Auto SL-M order at 25900
```

## Order Flow Diagram

```
User Interaction
      ↓
Select Order Type Button (LIMIT/MARKET/MARKET_PROTECTION/SL-M/SL-L)
      ↓
Select Product Type (MARGIN/INTRADAY)
      ↓
Fill Conditional Fields (based on order type)
      ↓
Click BUY/SELL Action Button
      ↓
Frontend Formats Order Data
      ↓
Send to Backend API (/api/orders)
      ↓
Backend Processing:
  • Validate symbol
  • Calculate protection price (if MARKET_PROTECTION)
  • Insert order into database
  • Execute if MARKET/MARKET_PROTECTION
  • Create position on execution
  • Create SL order if predefined_sl enabled
      ↓
Return Success/Failure Response
      ↓
Update UI (Order Book, Positions, Message)
```

## Technical Mapping

### Frontend → Backend Order Type Mapping
```javascript
LIMIT              → 'LIMIT'
MARKET             → 'MARKET'
MARKET_PROTECTION  → 'MARKET_PROTECTION'
SL-M               → 'STOPLOSS_MARKET'
SL-L               → 'STOPLOSS_LIMIT'
```

### Frontend → Backend Product Type Mapping
```javascript
MARGIN    → 'DELIVERY'
INTRADAY  → 'INTRADAY'
```

## Data Structure

### Order Object Sent to Backend
```json
{
  "symbol": "NIFTY 50",
  "order_type": "MARKET_PROTECTION",
  "transaction_type": "BUY",
  "quantity": 50,
  "price": 27300,
  "trigger_price": null,
  "market_protection_percentage": 5,
  "product_type": "INTRADAY",
  "predefined_sl": false,
  "target_price": null,
  "tradingMode": "paper"
}
```

### Order Stored in Database
```sql
INSERT INTO orders (
  symbol,
  symbol_id,
  order_type,
  transaction_type,
  quantity,
  price,
  trigger_price,
  product_type,
  status,
  trading_mode,
  order_timestamp
) VALUES (
  'NIFTY 50',
  123,
  'MARKET_PROTECTION',
  'BUY',
  50,
  27300.00,
  NULL,
  'INTRADAY',
  'executed',
  'paper',
  NOW()
);
```

## Keyboard Shortcuts (Future Enhancement)
```
L  → LIMIT order
M  → MARKET order
P  → MARKET PROTECTION
S  → SL-M
H  → SL-L (SL with limit)
```

## Status Indicators
```
🟢 Green Button = Selected order type
⚪ White Button = Unselected
✅ Executed = Order filled
⏳ Pending = Order waiting
❌ Cancelled = Order cancelled
```

## Quick Testing Commands

### Test MARKET Order
```powershell
# PowerShell
$body = '{"symbol":"NIFTY 50","order_type":"MARKET","transaction_type":"BUY","quantity":50,"product_type":"INTRADAY","tradingMode":"paper"}'
Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"
```

### Test MARKET_PROTECTION Order
```powershell
$body = '{"symbol":"NIFTY 50","order_type":"MARKET_PROTECTION","transaction_type":"BUY","quantity":50,"market_protection_percentage":5,"product_type":"INTRADAY","tradingMode":"paper"}'
Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"
```

### Check Orders
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/orders"
```

## Files Modified Summary

| File | Changes |
|------|---------|
| `components/trading/trade-form.tsx` | Added order type buttons, conditional fields |
| `components/trading/action-buttons.tsx` | Updated order mapping, added protection calculation |
| `backend/routes/orders.js` | Added market protection, predefined SL logic |

## Documentation Files Created

1. ✅ `ORDER_TYPES_IMPLEMENTATION.md` - Complete implementation details
2. ✅ `ORDER_TYPES_TESTING.md` - Testing guide and procedures
3. ✅ `ORDER_TYPES_QUICK_REFERENCE.md` - This file (quick reference)

---

**Status**: 🟢 All Order Types Fully Implemented and Working
**Last Updated**: 2024-11-24
**Version**: 1.0.0
