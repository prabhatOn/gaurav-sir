'use client'

import { useState, useEffect } from 'react'
import { useMarket } from '@/components/market/market-context'
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'
import { PlaceLimitOrderDialog } from './place-limit-order-dialog'

export function ActionButtons({ selectedBroker, tradingMode }: { selectedBroker: string | null; tradingMode: 'paper' | 'live' }) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [showLimitDialog, setShowLimitDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<{
    type: 'sell-call' | 'buy-call' | 'buy-put' | 'sell-put'
    symbol: string
  } | null>(null)
  const [message, setMessage] = useState<string>('-')
  const [formData, setFormData] = useState<any>(null)
  const market = useMarket()

  useEffect(() => {
    const handler = (e: any) => setFormData(e.detail)
    window.addEventListener('tradeFormUpdated', handler)
    return () => window.removeEventListener('tradeFormUpdated', handler)
  }, [])

  // handle dropdown actions (small ▼ button) e.g. place-limit-order
  const handleDropdownAction = (action: string, orderType: string) => {
    // Close the dropdown
    setOpenDropdown(null)
    if (action === 'place-limit-order') {
      // open the limit dialog and pre-fill selectedOrder
      setSelectedOrder({ type: orderType as any, symbol: formData?.symbol || '' })
      setShowLimitDialog(true)
      return
    }
    if (action === 'add-to-bucket') {
      // Build position data from latest formData and the orderType from the button
      try {
        // helper: format expiry like '25-Nov-2025' -> '25-NOV-25'
        const formatExpiryForSymbol = (expiry: string) => {
          const parts = String(expiry || '').split('-')
          if (parts.length !== 3) return expiry
          const day = parts[0]
          const month = parts[1].toUpperCase()
          const year = parts[2].slice(-2)
          return `${day}-${month}-${year}`
        }

        const resolveOptionLtp = (underlying: string, expiryRaw: string, strike: string, side: 'CE' | 'PE') => {
          try {
            const formattedExpiry = formatExpiryForSymbol(expiryRaw || '')
            const targetKey = `${underlying}-${formattedExpiry}-${strike}-${side}`
            const direct = market?.symbols?.[targetKey]?.ltp
            if (direct !== undefined) return direct

            // fallback: search for best match
            const entries = Object.entries(market?.symbols || {})
            for (const [k, v] of entries) {
              try {
                const ku = k.toUpperCase()
                if (!ku.includes(String(underlying).toUpperCase())) continue
                if (!ku.includes(String(strike))) continue
                if (!ku.endsWith(side)) continue
                if (v && typeof v.ltp === 'number') return v.ltp
              } catch (e) {}
            }
          } catch (e) {}
          // final fallback: use underlying symbol LTP if available
          try {
            const base = market?.symbols?.[underlying]
            if (base && typeof base.ltp === 'number') return base.ltp
          } catch (e) {}
          return undefined
        }

        const qtyRaw = parseInt(formData?.qty || '1') || 1
        const isSell = orderType.startsWith('sell')
        const isCall = orderType.includes('call')

        const position = {
          symbol: formData?.symbol || '',
          expiry: formData?.expiryDate || formData?.expiry || '',
          strike: Number(isCall ? formData?.callStrike || 0 : formData?.putStrike || 0) || 0,
          cepe: isCall ? 'CE' : 'PE',
          qty: isSell ? -Math.abs(qtyRaw) : Math.abs(qtyRaw),
          type: formData?.orderType === 'Limit' ? 'LIMIT' : 'MKT',
          price: formData?.price ? Number(formData.price) : 0,
          ltp: 0
        }

        // Try to resolve live LTP from market context for the specific option
        try {
          const strikeStr = String(position.strike || '')
          const side = position.cepe
          const marketLtp = resolveOptionLtp(position.symbol || 'BANKNIFTY', position.expiry || '', strikeStr, side)
          if (marketLtp !== undefined) position.ltp = marketLtp
          else if (position.price) position.ltp = position.price
        } catch (e) {
          // ignore
        }

        // Dispatch CustomEvent that `BasketOrderTab` listens for
        try {
          window.dispatchEvent(new CustomEvent('addToBasket', { detail: position }))
        } catch (err) {
          console.warn('CustomEvent dispatch failed, falling back to postMessage', err)
          try { window.postMessage({ type: 'addToBasket', detail: position }, '*') } catch (e) { }
        }

        // Also write a debug key so BasketOrderTab can recover if mounted later
        try { localStorage.setItem('lastAddToBasket', JSON.stringify({ data: position })) } catch (e) { }

        setMessage('Added to bucket')
      } catch (err) {
        console.error('Error preparing add-to-bucket position', err)
        setMessage('Failed to add to bucket')
      }

      return
    }
  }

  const placeOrder = async (orderType: string, transactionType: 'BUY' | 'SELL') => {
    if (!formData) {
      setMessage('Form data not available')
      return
    }

    try {
      setMessage('Placing order...')
      
      // Map order type to backend format
      let order_type = 'MARKET'
      let price = null
      let trigger_price = null
      let market_protection_percentage = null

      if (formData.orderType === 'LIMIT') {
        order_type = 'LIMIT'
        price = formData.price ? parseFloat(formData.price) : null
      } else if (formData.orderType === 'MARKET') {
        order_type = 'MARKET'
        price = null // Will be set to LTP in backend
      } else if (formData.orderType === 'SL-M') {
        order_type = 'STOPLOSS_MARKET'
        trigger_price = formData.triggerPrice ? parseFloat(formData.triggerPrice) : null
      } else if (formData.orderType === 'SL-L') {
        order_type = 'STOPLOSS_LIMIT'
        trigger_price = formData.triggerPrice ? parseFloat(formData.triggerPrice) : null
        price = formData.price ? parseFloat(formData.price) : null
      } else if (formData.orderType === 'MARKET_PROTECTION') {
        order_type = 'MARKET_PROTECTION'
        price = null
        market_protection_percentage = formData.marketProtection 
          ? parseFloat(formData.marketProtection.replace('%', '')) 
          : 5 // default 5%
      }

      // Map product type to backend format
      let product_type = 'INTRADAY'
      if (formData.productType === 'MARGIN') {
        product_type = 'DELIVERY'
      } else if (formData.productType === 'INTRADAY') {
        product_type = 'INTRADAY'
      }

      const orderData = {
        symbol: formData.symbol,
        order_type,
        transaction_type: transactionType,
        quantity: parseInt(formData.qty) || 1,
        price,
        trigger_price,
        market_protection_percentage,
        product_type,
        predefined_sl: formData.predefinedSL || false,
        target_price: formData.targetPrice ? parseFloat(formData.targetPrice) : null,
        tradingMode
      }

      let url = 'http://localhost:5000/api/orders'
      if (selectedBroker && tradingMode === 'live') {
        url = `http://localhost:5000/api/brokers/${selectedBroker}/orders`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      const result = await response.json()
      
      if (result.status) {
        setMessage(`Order placed successfully: ${result.data?.id || 'Unknown'}`)
      } else {
        setMessage(`Order failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setMessage(`Error placing order: ${error.message}`)
    }
  }

  const closeAllPositions = async () => {
    try {
      setMessage('Closing all positions...')
      // TODO: Implement close all positions functionality
      setMessage('Close all positions feature not yet implemented')
    } catch (error) {
      setMessage(`Error closing positions: ${error.message}`)
    }
  }

  const cancelAllOrders = async () => {
    try {
      setMessage('Cancelling all orders...')
      // Get all pending orders and cancel them
      const response = await fetch('http://localhost:5000/api/orders')
      const data = await response.json()
      
      if (data.status && data.data) {
        const pendingOrders = data.data.filter((order: any) => order.order_status === 'pending')
        for (const order of pendingOrders) {
          await fetch(`http://localhost:5000/api/orders/${order.id}/cancel`, {
            method: 'PUT'
          })
        }
        setMessage(`Cancelled ${pendingOrders.length} pending orders`)
      }
    } catch (error) {
      setMessage(`Error cancelling orders: ${error.message}`)
    }
  }

  const DropdownMenu = ({ orderType }: { orderType: string }) => {
    const isOpen = openDropdown === orderType
    return (
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(isOpen ? null : orderType)}
          className="w-9 h-9 flex items-center justify-center bg-white text-gray-600 border border-gray-300 rounded shadow-sm text-xs hover:bg-gray-50 transition-colors"
        >
          ▼
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-max">
            <button
              onClick={() => handleDropdownAction('add-to-bucket', orderType)}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 border-b border-gray-200"
            >
              Add to bucket
            </button>
            <button
              onClick={() => handleDropdownAction('place-limit-order', orderType)}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
            >
              Place limit order
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          {/* Left column: Call side */}
          <div className="flex items-center gap-2 md:justify-start flex-wrap">
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors"
                onClick={() => placeOrder('sell-call', 'SELL')}
              >
                <ArrowLeft className="w-4 h-4" />
                Sell Call
              </button>
              <DropdownMenu orderType="sell-call" />
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1 px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition-colors"
                onClick={() => placeOrder('buy-call', 'BUY')}
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
                Buy Call
              </button>
              <DropdownMenu orderType="buy-call" />
            </div>
          </div>

          {/* Middle column: global actions */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={closeAllPositions}
                className="px-6 py-2 bg-white text-red-600 border border-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                Close All Positions / F6
              </button>
              <button 
                onClick={cancelAllOrders}
                className="px-6 py-2 bg-white text-red-600 border border-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                Cancel All Orders / F7
              </button>
              <button className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">
                <RotateCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Right column: Put side */}
          <div className="flex items-center gap-2 md:justify-end flex-wrap">
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1 px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition-colors"
                onClick={() => placeOrder('buy-put', 'BUY')}
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
                Buy Put
              </button>
              <DropdownMenu orderType="buy-put" />
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors"
                onClick={() => placeOrder('sell-put', 'SELL')}
              >
                <ArrowRight className="w-4 h-4" />
                Sell Put
              </button>
              <DropdownMenu orderType="sell-put" />
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600 text-center py-1">Message: {message}</p>
      </div>

      {selectedOrder && (
        <PlaceLimitOrderDialog
          isOpen={showLimitDialog}
          onClose={() => {
            setShowLimitDialog(false)
            setSelectedOrder(null)
          }}
          orderType={selectedOrder.type}
          symbol={selectedOrder.symbol}
        />
      )}
    </>
  )
}
