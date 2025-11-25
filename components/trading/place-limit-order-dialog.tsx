'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useMarket } from '@/components/market/market-context'

interface PlaceLimitOrderDialogProps {
  isOpen: boolean
  onClose: () => void
  orderType: 'sell-call' | 'buy-call' | 'buy-put' | 'sell-put'
  symbol: string
  expiry?: string
  strike?: number
  cepe?: 'CE' | 'PE'
}

export function PlaceLimitOrderDialog({
  isOpen,
  onClose,
  orderType,
  symbol,
  expiry,
  strike,
  cepe,
}: PlaceLimitOrderDialogProps) {
  const [orderTypeSelected, setOrderTypeSelected] = useState<'limit' | 'market' | 'sl-l' | 'sl-m' | 'mp'>('limit')
  const [marginType, setMarginType] = useState<'margin' | 'intraday'>('margin')
  const [buySellToggle, setBuySellToggle] = useState<'buy' | 'sell'>(orderType.includes('buy') ? 'buy' : 'sell')
  const isBuy = buySellToggle === 'buy'
  const [quantity, setQuantity] = useState(35)
  const [price, setPrice] = useState(452.1)
  const [isAMO, setIsAMO] = useState(false)
  const [keepWindowOpen, setKeepWindowOpen] = useState(false)
  const market = useMarket()

  if (!isOpen) return null

  const getDisplaySymbol = () => {
    // Use the buySellToggle to reflect the current buy/sell selection in the header
    const typeLabel = orderType.includes('call') ? 'CE' : 'PE'
    const action = buySellToggle === 'sell' ? 'SELL' : 'BUY'
    return `${action}: ${symbol.replace('CE', typeLabel)}`
  }

  const handlePlaceOrder = async () => {
    try {
      const orderData = {
        symbol: symbol,
        order_type: orderTypeSelected,
        transaction_type: buySellToggle.toUpperCase(),
        quantity: quantity,
        price: orderTypeSelected === 'limit' ? price : 0,
        trigger_price: orderTypeSelected.includes('sl') ? price : 0, // For stop loss orders
        product_type: marginType === 'margin' ? 'MIS' : 'NRML'
      }

      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      const result = await response.json()
      
      if (result.status) {
        console.log('Limit order placed successfully:', result.data)
        // Reset form or close dialog based on keepWindowOpen
        if (!keepWindowOpen) {
          onClose()
        } else {
          // Reset form but keep dialog open
          setQuantity(35)
          setPrice(452.1)
        }
      } else {
        console.error('Failed to place limit order:', result.error)
      }
    } catch (error) {
      console.error('Error placing limit order:', error)
    }
  }

  const handleAddToBasket = () => {
    try {
      // Try to infer expiry/strike/cepe if not provided
      const inferExpiry = expiry || ''
      const inferStrike = strike || (() => {
        try {
          const parts = String(symbol).split('-')
          // last-but-one part is strike when symbol is in form BASE-EXPIRY-STRIKE-CE/PE
          if (parts.length >= 3) return Number(parts[parts.length - 2]) || 0
        } catch (e) {}
        return 0
      })()
      const inferCepe = cepe || (() => {
        try {
          const parts = String(symbol).split('-')
          const last = parts[parts.length - 1]
          if (last && (last.toUpperCase() === 'CE' || last.toUpperCase() === 'PE')) return last.toUpperCase() as 'CE' | 'PE'
        } catch (e) {}
        return 'CE'
      })()

      const position = {
        symbol: symbol,
        expiry: inferExpiry,
        strike: Number(inferStrike || 0),
        cepe: inferCepe,
        qty: buySellToggle === 'sell' ? -Math.abs(quantity) : Math.abs(quantity),
        type: orderTypeSelected === 'limit' ? 'LIMIT' : 'MKT',
        price: orderTypeSelected === 'limit' ? Number(price) : 0,
        ltp: market.symbols[symbol]?.ltp || (orderTypeSelected === 'limit' ? Number(price) : 0)
      }

      try {
        window.dispatchEvent(new CustomEvent('addToBasket', { detail: position }))
      } catch (err) {
        try { window.postMessage({ type: 'addToBasket', detail: position }, '*') } catch (e) { }
      }
      try { localStorage.setItem('lastAddToBasket', JSON.stringify({ data: position })) } catch (e) { }

      // give a small confirmation by closing or keeping open according to keepWindowOpen
      if (!keepWindowOpen) onClose()
    } catch (err) {
      console.error('Failed to add to basket from dialog', err)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-md rounded-lg overflow-hidden shadow-xl mx-2">
        {/* Header */}
        <div className={`${isBuy ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-3 flex items-center justify-between`}> 
          <h2 className="text-sm font-bold">{getDisplaySymbol()}</h2>
          <button
            onClick={onClose}
              className={`${isBuy ? 'hover:bg-green-700' : 'hover:bg-red-700'} p-1 rounded transition-colors`}
          >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-white ${isBuy ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'} border ring-0`}> 
                <X className="w-4 h-4" />
              </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-4">
          {/* LTP and Toggles */}
          <div className="space-y-4">
            <div className="text-base font-semibold">LTP: {market.symbols[symbol]?.ltp ?? price}</div>

            {/* Margin/Intraday Toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setMarginType('margin')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  marginType === 'margin'
                    ? (isBuy ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                    : (isBuy ? 'bg-white text-green-600 border border-green-600' : 'bg-white text-red-600 border border-red-600')
                }`}
              >
                MARGIN
              </button>
              <button
                onClick={() => setMarginType('intraday')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  marginType === 'intraday'
                    ? (isBuy ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                    : (isBuy ? 'bg-white text-green-600 border border-green-600' : 'bg-white text-red-600 border border-red-600')
                }`}
              >
                INTRADAY
              </button>
            </div>

            {/* Buy/Sell Toggle */}
            {/* Buy/Sell Toggle */}
              <div className="flex gap-3 items-center justify-between">
                <span className="text-xs font-medium">BUY</span>
                <div
                  onClick={() => setBuySellToggle(buySellToggle === 'buy' ? 'sell' : 'buy')}
                  role="switch"
                  aria-checked={isBuy}
                  tabIndex={0}
                  className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors flex items-center ${isBuy ? 'bg-green-600' : 'bg-red-600'}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setBuySellToggle(buySellToggle === 'buy' ? 'sell' : 'buy') }}
                >
                  <div className={`absolute w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${isBuy ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
                <span className="text-xs font-medium">SELL</span>
              </div>
          </div>

          {/* Order Type Selection */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'limit', label: 'LIMIT' },
              { id: 'market', label: 'MARKET' },
              { id: 'mp', label: 'MARKET PROTECTION' },
              { id: 'sl-l', label: 'SL-L' },
              { id: 'sl-m', label: 'SL-M' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setOrderTypeSelected(type.id as any)}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  orderTypeSelected === type.id
                    ? (isBuy ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                    : (isBuy ? 'bg-white text-green-600 border border-green-600' : 'bg-white text-red-600 border border-red-600')
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Qty (Lot size: 1)</label>
              <div className="flex items-center border border-gray-300 rounded">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex-1 py-1 text-center hover:bg-gray-100 text-base"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="flex-1 text-center py-1.5 border-0 focus:outline-none text-sm"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex-1 py-1 text-center hover:bg-gray-100 text-base"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Price(Tick size: 0.05)</label>
              <div className={`${isBuy ? 'border-green-600' : 'border-red-600'} border rounded`}>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full py-1.5 px-2 focus:outline-none text-sm"
                />
                <div className={`flex justify-between px-2 py-1 ${isBuy ? 'border-t border-green-600' : 'border-t border-red-600'} text-gray-400 text-xs`}>
                  <button className="hover:text-gray-600">▲</button>
                  <button className="hover:text-gray-600">▼</button>
                </div>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAMO}
                onChange={(e) => setIsAMO(e.target.checked)}
                className={`w-4 h-4 border rounded ${isBuy ? 'border-green-600' : 'border-red-600'}`}
              />
              <span className="text-sm text-gray-700">Is AMO Order</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={keepWindowOpen}
                onChange={(e) => setKeepWindowOpen(e.target.checked)}
                className={`w-4 h-4 border rounded ${isBuy ? 'border-green-600' : 'border-red-600'}`}
              />
              <span className="text-sm text-gray-700">Keep this window open after placing the order</span>
            </label>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 space-y-1">
            <p>• If the user places a limit order and it goes into pending status, the Positions will not be automatically update after the pending limit order is executed, and the user must click the refresh button located near the funds tab.</p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-2 items-center md:items-stretch">
            <button
              onClick={onClose}
              className="w-full md:flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded font-semibold text-sm hover:bg-gray-300 transition-colors shadow-sm"
            >
              CANCEL
            </button>
            <button
              onClick={handleAddToBasket}
              className="w-full md:flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-semibold text-sm transition-colors shadow-md"
            >
              ADD TO BASKET
            </button>
            <button
              onClick={handlePlaceOrder}
              className={`w-full md:flex-1 px-3 py-2 ${isBuy ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded font-semibold text-sm transition-colors shadow-md`}
            >
              PLACE ORDER
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
