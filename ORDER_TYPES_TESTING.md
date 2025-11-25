# Order Types Testing Guide

## Prerequisites
1. Backend server running on http://localhost:5000
2. Frontend running on http://localhost:3000
3. Database connected (trading_pro)
4. Market data available (even if market closed)

## Manual Testing Steps

### 1. Test Order Type Buttons

#### LIMIT Order
1. Open trading form
2. Click **LIMIT** button (should turn green)
3. Verify "Limit Price" field appears
4. Enter price (e.g., 25000)
5. Select symbol (NIFTY 50)
6. Enter quantity (e.g., 50)
7. Click **BUY CALL** or **SELL CALL**
8. Check order book - should show LIMIT order with specified price

#### MARKET Order
1. Click **MARKET** button (should turn green)
2. Verify no price field appears
3. Select symbol (BANKNIFTY)
4. Enter quantity (e.g., 15)
5. Click **BUY CALL**
6. Check order book - should show EXECUTED immediately with LTP

#### MARKET PROTECTION Order
1. Click **MARKET PROTECTION** button (should turn green)
2. Verify "Protection %" field appears
3. Enter protection percentage (e.g., 5)
4. Select symbol (NIFTY 50)
5. Note current LTP (e.g., 25959.5)
6. Enter quantity (e.g., 50)
7. Click **BUY CALL**
8. Check execution price should be: LTP × 1.05 = 27257.48
9. For SELL: Price should be LTP × 0.95 = 24661.53

#### SL-M (Stop Loss Market)
1. Click **SL-M** button (should turn green)
2. Verify "Trigger Price" field appears
3. Select symbol with LTP 26000
4. Enter trigger price: 25800 (for stop loss)
5. Enter quantity: 50
6. Click **SELL CALL**
7. Check order book - should show PENDING with trigger price
8. Order should execute when market reaches 25800

#### SL-L (Stop Loss Limit)
1. Click **SL-L** button (should turn green)
2. Verify both "Trigger Price" and "Limit Price" fields appear
3. Select symbol with LTP 26000
4. Enter trigger price: 25800
5. Enter limit price: 25700
6. Enter quantity: 50
7. Click **SELL CALL**
8. Check order book - should show PENDING
9. When market hits 25800, becomes LIMIT order at 25700

### 2. Test Product Type Buttons

#### MARGIN
1. Click **MARGIN** button (should turn green)
2. Place any order type
3. Verify backend receives `product_type: 'DELIVERY'`
4. Position should be marked as carryforward

#### INTRADAY
1. Click **INTRADAY** button (should turn green)
2. Place any order type
3. Verify backend receives `product_type: 'INTRADAY'`
4. Position should be marked as MIS

### 3. Test Predefined SL/Target

#### Basic Flow
1. Enable "Predefined SL" checkbox
2. Enter "Predefined Target": 100 (points)
3. Place MARKET order
4. Check order book:
   - Main order should be EXECUTED
   - Additional STOPLOSS_MARKET order should be created
   - SL trigger = Entry Price - 100

### 4. Test Conditional Fields

#### Field Visibility
- LIMIT: Shows "Limit Price"
- MARKET: No extra fields (except protection if MARKET_PROTECTION)
- MARKET_PROTECTION: Shows "Protection %"
- SL-M: Shows "Trigger Price"
- SL-L: Shows both "Trigger Price" and "Limit Price"

#### Field Validation
- All price fields should accept decimal values
- Quantity should be positive integer
- Protection % should be 0-100
- Empty fields should show validation errors

## Backend Testing

### Test Order Creation API

```powershell
# Test LIMIT Order
$body = @{
    symbol = "NIFTY 50"
    order_type = "LIMIT"
    transaction_type = "BUY"
    quantity = 50
    price = 26000
    product_type = "INTRADAY"
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"

# Test MARKET Order
$body = @{
    symbol = "BANKNIFTY"
    order_type = "MARKET"
    transaction_type = "BUY"
    quantity = 15
    product_type = "INTRADAY"
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"

# Test MARKET_PROTECTION Order
$body = @{
    symbol = "NIFTY 50"
    order_type = "MARKET_PROTECTION"
    transaction_type = "BUY"
    quantity = 50
    market_protection_percentage = 5
    product_type = "INTRADAY"
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"

# Test SL-M Order
$body = @{
    symbol = "NIFTY 50"
    order_type = "STOPLOSS_MARKET"
    transaction_type = "SELL"
    quantity = 50
    trigger_price = 25800
    product_type = "INTRADAY"
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"

# Test SL-L Order
$body = @{
    symbol = "NIFTY 50"
    order_type = "STOPLOSS_LIMIT"
    transaction_type = "SELL"
    quantity = 50
    trigger_price = 25800
    price = 25700
    product_type = "INTRADAY"
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"

# Test Predefined SL
$body = @{
    symbol = "NIFTY 50"
    order_type = "MARKET"
    transaction_type = "BUY"
    quantity = 50
    product_type = "INTRADAY"
    predefined_sl = $true
    target_price = 100
    tradingMode = "paper"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/orders" -Method POST -Body $body -ContentType "application/json"
```

### Verify Database

```sql
-- Check orders table
SELECT 
    id,
    symbol,
    order_type,
    transaction_type,
    quantity,
    price,
    trigger_price,
    product_type,
    status,
    order_timestamp
FROM orders
ORDER BY id DESC
LIMIT 10;

-- Check positions
SELECT 
    id,
    symbol,
    quantity,
    average_price,
    unrealized_pnl,
    trading_mode
FROM positions;

-- Check market protection calculation
SELECT 
    symbol,
    order_type,
    price,
    (price / 1.05) as original_ltp_approx
FROM orders
WHERE order_type = 'MARKET_PROTECTION';
```

## Expected Results

### LIMIT Order
- Status: PENDING
- Price: As specified
- Executes only when market reaches limit price

### MARKET Order
- Status: EXECUTED (immediate)
- Price: Current LTP
- Creates position immediately

### MARKET_PROTECTION Order
- Status: EXECUTED (immediate)
- Price: LTP ± protection%
- BUY: LTP × (1 + protection%/100)
- SELL: LTP × (1 - protection%/100)

### SL-M Order
- Status: PENDING
- Trigger Price: As specified
- No limit price stored
- Becomes MARKET order when triggered

### SL-L Order
- Status: PENDING
- Trigger Price: As specified
- Limit Price: As specified
- Becomes LIMIT order when triggered

## Common Issues & Solutions

### Issue: Order Type Button Not Highlighting
**Solution**: Check CSS classes - green background should apply when selected

### Issue: Conditional Fields Not Showing
**Solution**: Verify orderType state matches button value exactly (case-sensitive)

### Issue: Backend Returns Error
**Solution**: 
1. Check console logs in backend
2. Verify database connection
3. Ensure symbol exists in symbols table
4. Check all required fields are sent

### Issue: Market Protection Price Incorrect
**Solution**: Verify calculation:
- BUY: `price = ltp * (1 + protection% / 100)`
- SELL: `price = ltp * (1 - protection% / 100)`

### Issue: Predefined SL Not Creating
**Solution**: 
1. Ensure predefined_sl is true
2. Verify target_price is provided
3. Check main order executed first
4. Look for second order in database

## Browser Console Testing

```javascript
// Check form state
window.addEventListener('tradeFormUpdated', (e) => {
    console.log('Form Data:', e.detail);
});

// Simulate order placement
const orderData = {
    symbol: 'NIFTY 50',
    order_type: 'MARKET_PROTECTION',
    transaction_type: 'BUY',
    quantity: 50,
    market_protection_percentage: 5,
    product_type: 'INTRADAY',
    tradingMode: 'paper'
};

fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
})
.then(r => r.json())
.then(data => console.log('Order Result:', data))
.catch(err => console.error('Order Error:', err));
```

## Success Criteria

✅ All 5 order type buttons are clickable and toggle green when selected
✅ All 2 product type buttons are clickable and toggle green when selected
✅ Conditional fields appear/disappear based on order type selection
✅ LIMIT orders show price field
✅ MARKET orders have no extra fields
✅ MARKET_PROTECTION shows protection % field
✅ SL-M shows trigger price field
✅ SL-L shows both trigger and limit price fields
✅ Orders are sent to backend with correct format
✅ Backend calculates market protection price correctly
✅ Market orders execute immediately in paper mode
✅ Limit orders stay pending
✅ Predefined SL creates additional stop loss order
✅ Order book displays all orders with correct details
✅ Positions are updated when orders execute

## Performance Checklist

- [ ] Button clicks respond within 100ms
- [ ] Field visibility changes are instant
- [ ] Order placement completes within 500ms
- [ ] No console errors during normal operation
- [ ] Form state updates propagate correctly
- [ ] Backend logs show correct order type mapping
- [ ] Database insertions succeed
- [ ] Position calculations are accurate

## Completed Testing Summary

Date: ___________
Tester: __________

| Feature | Status | Notes |
|---------|--------|-------|
| LIMIT Button | ⬜ | |
| MARKET Button | ⬜ | |
| MARKET_PROTECTION Button | ⬜ | |
| SL-M Button | ⬜ | |
| SL-L Button | ⬜ | |
| MARGIN Button | ⬜ | |
| INTRADAY Button | ⬜ | |
| Conditional Fields | ⬜ | |
| Protection % Calculation | ⬜ | |
| Predefined SL | ⬜ | |
| Backend Order Creation | ⬜ | |
| Database Storage | ⬜ | |
| Position Updates | ⬜ | |

---

**Note**: This testing guide covers all order types and features. Perform tests systematically and document any issues found for resolution.
