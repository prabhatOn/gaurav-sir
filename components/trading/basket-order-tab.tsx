"use client"

import { useState, useEffect, useMemo } from 'react'
import { useMarket } from '@/components/market/market-context'
import { BasketOrderTable } from './basket-order-table'
import { OiPulsePayoffChart } from './oi-pulse-payoff-chart'

interface BasketPosition {
  id: string
  symbol: string
  expiry: string
  strike: number
  cepe: 'CE' | 'PE'
  qty: number
  type: 'MKT' | 'LIMIT'
  price: number
  ltp: number
  brokerId?: number
}

interface SavedBasket {
  id: number
  name: string
  positions: BasketPosition[]
  createdAt: string
}

interface ReadyBasket {
  name: string
  description: string
  positions: Omit<BasketPosition, 'id'>[]
}

const READY_BASKETS: ReadyBasket[] = [
  // Demo baskets removed - load real baskets from API
]

export function BasketOrderTab() {
  const [basketPositions, setBasketPositions] = useState<BasketPosition[]>([])
  const [savedBaskets, setSavedBaskets] = useState<SavedBasket[]>([])
  const [dynamicReadyBaskets, setDynamicReadyBaskets] = useState<ReadyBasket[]>(READY_BASKETS)
  const [currentBasketName, setCurrentBasketName] = useState('')
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showReadyBaskets, setShowReadyBaskets] = useState(false)
  const [multiplier, setMultiplier] = useState(1)
  const [expiry, setExpiry] = useState('25-Nov-2025')
  const [orderType, setOrderType] = useState<'MKT' | 'LIMIT'>('MKT')
  const [isPlacingOrders, setIsPlacingOrders] = useState(false)
  const [lastAdded, setLastAdded] = useState<BasketPosition | null>(null)
  const [showAddToast, setShowAddToast] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const market = useMarket()

  // Load saved baskets from backend
  useEffect(() => {
    fetchSavedBaskets()
    initializeDynamicReadyBaskets()
  }, [])

  const initializeDynamicReadyBaskets = async () => {
    try {
      // Fetch current expiries and strikes for BANKNIFTY
      const expiriesResponse = await fetch('http://localhost:5000/api/symbols/BANKNIFTY/expiries')
      const expiriesData = await expiriesResponse.json()
      
      if (expiriesData.status && expiriesData.data && expiriesData.data.length > 0) {
        const currentExpiry = expiriesData.data[0] // Use first available expiry
        
        // Fetch strikes for the current expiry
        const strikesResponse = await fetch(`http://localhost:5000/api/symbols/BANKNIFTY/expiries/${encodeURIComponent(currentExpiry)}/strikes`)
        const strikesData = await strikesResponse.json()
        
        if (strikesData.status && strikesData.data && strikesData.data.length > 0) {
          const strikes = strikesData.data.sort((a: number, b: number) => a - b)
          const atmStrike = strikes[Math.floor(strikes.length / 2)] // ATM strike
          const otmStrike = strikes[Math.floor(strikes.length / 2) + 2] || atmStrike + 1000 // OTM strike
          const itmStrike = strikes[Math.floor(strikes.length / 2) - 2] || atmStrike - 1000 // ITM strike

          const dynamicBaskets: ReadyBasket[] = [
            {
              name: 'Bull Call Spread',
              description: 'Buy ATM Call, Sell OTM Call',
              positions: [
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: atmStrike, cepe: 'CE', qty: 1, type: 'MKT', price: 0, ltp: 0 },
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: otmStrike, cepe: 'CE', qty: -1, type: 'MKT', price: 0, ltp: 0 }
              ]
            },
            {
              name: 'Bear Put Spread',
              description: 'Buy ATM Put, Sell OTM Put',
              positions: [
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: atmStrike, cepe: 'PE', qty: 1, type: 'MKT', price: 0, ltp: 0 },
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: itmStrike, cepe: 'PE', qty: -1, type: 'MKT', price: 0, ltp: 0 }
              ]
            },
            {
              name: 'Iron Condor',
              description: 'Sell OTM Call, Buy farther OTM Call, Sell OTM Put, Buy farther OTM Put',
              positions: [
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: otmStrike, cepe: 'CE', qty: -1, type: 'MKT', price: 0, ltp: 0 },
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: otmStrike + 1000, cepe: 'CE', qty: 1, type: 'MKT', price: 0, ltp: 0 },
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: itmStrike, cepe: 'PE', qty: -1, type: 'MKT', price: 0, ltp: 0 },
                { symbol: 'BANKNIFTY', expiry: currentExpiry, strike: itmStrike - 1000, cepe: 'PE', qty: 1, type: 'MKT', price: 0, ltp: 0 }
              ]
            }
          ]
          
          setDynamicReadyBaskets(dynamicBaskets)
        }
      }
    } catch (error) {
      console.error('Error initializing dynamic ready baskets:', error)
      // Fallback to static baskets
      setDynamicReadyBaskets(READY_BASKETS)
    }
  }

  const fetchSavedBaskets = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/baskets')
      const data = await response.json()
      if (data.status && data.data) {
        setSavedBaskets(data.data)
      }
    } catch (err) {
      console.error('Error fetching saved baskets:', err)
    }
  }

  // Update LTP in real-time
  useEffect(() => {
    if (!market.symbols || Object.keys(market.symbols).length === 0) return

    setBasketPositions(prev => prev.map(pos => {
      // Try to find LTP for the specific option contract first
      const formatExpiry = (expiry: string) => {
        const parts = expiry.split('-')
        if (parts.length !== 3) return expiry
        const day = parts[0]
        const month = parts[1].toUpperCase()
        const year = parts[2].slice(-2)
        return `${day}-${month}-${year}`
      }
      const formattedExpiry = formatExpiry(pos.expiry)
      const optionKey = `${pos.symbol}-${formattedExpiry}-${pos.strike}-${pos.cepe}`
      
      // First try the specific option key, then fallback to base symbol
      const marketData = market.symbols[optionKey] || market.symbols[pos.symbol]
      return { ...pos, ltp: marketData?.ltp || pos.ltp }
    }))
  }, [market.symbols])

  // Listen for addToBasket events
  useEffect(() => {
    const handleAddToBasket = (e: Event) => {
      const custom = e as CustomEvent
      const positionData = custom.detail
      const newPosition: BasketPosition = { id: Date.now().toString(), ...positionData }
      setBasketPositions(prev => [...prev, newPosition])
      setLastAdded(newPosition)
      setShowAddToast(true)
      window.setTimeout(() => setShowAddToast(false), 2000)
    }
    const handleMessage = (ev: MessageEvent) => {
      try {
        if (ev?.data && ev.data.type === 'addToBasket') {
          const positionData = ev.data.detail
          const newPosition: BasketPosition = { id: Date.now().toString(), ...positionData }
          setBasketPositions(prev => [...prev, newPosition])
          setLastAdded(newPosition)
          setShowAddToast(true)
          window.setTimeout(() => setShowAddToast(false), 2000)
        }
      } catch (err) { console.error('postMessage handler error', err) }
    }

    window.addEventListener('addToBasket', handleAddToBasket)
    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('addToBasket', handleAddToBasket)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const handleUpdatePosition = (id: string, updates: Partial<BasketPosition>) => {
    setBasketPositions(positions => positions.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const handleRemovePosition = (id: string) => {
    setBasketPositions(positions => positions.filter(p => p.id !== id))
  }

  const handleClearAllOrders = () => setBasketPositions([])

  const handleSaveBasket = async () => {
    if (!currentBasketName.trim()) {
      setError('Please enter a basket name')
      return
    }
    if (basketPositions.length === 0) {
      setError('No positions to save')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const basketData = {
        name: currentBasketName,
        positions: basketPositions.map(p => ({
          symbol: p.symbol,
          expiry: p.expiry,
          strike: p.strike,
          cepe: p.cepe,
          qty: p.qty,
          type: p.type,
          price: p.price,
          transaction_type: p.qty > 0 ? 'BUY' : 'SELL'
        }))
      }

      const response = await fetch('http://localhost:5000/api/baskets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basketData)
      })
      const data = await response.json()
      if (data.status) {
        await fetchSavedBaskets()
        setCurrentBasketName('')
        setError('Basket saved successfully')
        setTimeout(() => setError(null), 3000)
      } else {
        setError(data.error || 'Failed to save basket')
      }
    } catch (err) {
      setError('Error saving basket')
      console.error('Save basket error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadBasket = (basket: SavedBasket) => {
    setBasketPositions(basket.positions.map(p => ({ ...p, id: Date.now().toString() + Math.random() })))
    setShowLoadDialog(false)
  }

  const handleLoadReadyBasket = (basket: ReadyBasket) => {
    setBasketPositions(basket.positions.map(p => ({ ...p, id: Date.now().toString() + Math.random() })))
    setShowReadyBaskets(false)
  }

  const handlePlaceAllOrders = async () => {
    if (basketPositions.length === 0) return

    setIsPlacingOrders(true)
    setError(null)
    let successCount = 0
    let errorCount = 0

    for (const position of basketPositions) {
      try {
        const orderData = {
          symbol: position.symbol,
          order_type: position.type,
          transaction_type: position.qty > 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(position.qty),
          price: position.type === 'LIMIT' ? position.price : null,
          product_type: 'MIS' // Default to MIS for options
        }

        const response = await fetch('http://localhost:5000/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        })
        const data = await response.json()
        if (data.status) {
          successCount++
        } else {
          errorCount++
        }
      } catch (err) {
        errorCount++
        console.error('Error placing order:', err)
      }
    }

    setIsPlacingOrders(false)
    if (errorCount === 0) {
      setError(`All ${successCount} orders placed successfully`)
      setBasketPositions([]) // Clear basket after successful placement
    } else {
      setError(`${successCount} orders placed, ${errorCount} failed`)
    }
    setTimeout(() => setError(null), 5000)
  }

  // Payoff calculation using real LTP
  const payoffData = useMemo(() => {
    if (basketPositions.length === 0) return [] as any[]
    const strikes = basketPositions.map(p => p.strike)
    const minStrike = Math.min(...strikes) - 2000
    const maxStrike = Math.max(...strikes) + 2000
    const step = 100
    const data = [] as any[]
    for (let spot = minStrike; spot <= maxStrike; spot += step) {
      let pnl = 0
      let t0 = 0
      basketPositions.forEach(pos => {
        const intrinsic = pos.cepe === 'CE' ? Math.max(0, spot - pos.strike) : Math.max(0, pos.strike - spot)
        const premium = pos.price
        const pay = (intrinsic - premium) * pos.qty * 100
        const t0pay = (intrinsic - (pos.ltp || pos.price)) * pos.qty * 100
        pnl += pay
        t0 += t0pay
      })
      data.push({ spot, pnl, t0 })
    }
    return data
  }, [basketPositions])

  const metrics = useMemo(() => {
    if (basketPositions.length === 0) return { currentSpot: 0, pnl: 0, margin: '-', maxProfit: 0, maxLoss: 0, breakeven: 0, riskReward: '-', daysLeft: 7 }
    const currentSpot = basketPositions[0]?.strike || 0
    const pnl = payoffData.find(d => Math.abs(d.spot - currentSpot) < 50)?.t0 || 0
    const maxProfit = Math.max(...payoffData.map(d => d.pnl))
    const maxLoss = Math.min(...payoffData.map(d => d.pnl))
    const breakevens = payoffData.filter(d => Math.abs(d.pnl) < 100).map(d => d.spot)
    return { currentSpot, pnl, margin: '-', maxProfit, maxLoss, breakeven: breakevens.length ? `${breakevens[0]} - ${breakevens[breakevens.length-1]}` : '-', riskReward: maxLoss !== 0 ? (Math.abs(maxProfit / maxLoss)).toFixed(2) : '-', daysLeft: 7 }
  }, [basketPositions, payoffData])

  const handleDistributeBasket = async (algorithm: string, maxBrokers: number) => {
    if (basketPositions.length === 0) return

    setIsPlacingOrders(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:5000/api/brokers/orders/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: basketPositions.map(p => ({
            symbol: p.symbol,
            expiry: p.expiry,
            strike: p.strike,
            cepe: p.cepe,
            qty: p.qty,
            type: p.type,
            price: p.price,
            brokerId: p.brokerId,
            transaction_type: p.qty > 0 ? 'BUY' : 'SELL'
          })),
          distributionAlgorithm: algorithm,
          maxBrokers: maxBrokers
        })
      })

      const data = await response.json()
      if (data.status) {
        setError(`Basket distributed successfully across ${data.data?.brokersUsed || maxBrokers} brokers`)
        setBasketPositions([]) // Clear basket after successful distribution
      } else {
        setError(data.error || 'Failed to distribute basket')
      }
    } catch (err) {
      setError('Error distributing basket')
      console.error('Error distributing basket:', err)
    } finally {
      setIsPlacingOrders(false)
      setTimeout(() => setError(null), 5000)
    }
  }

  return (
    <div className="bg-white">
      <div className="px-3 md:px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button onClick={handleClearAllOrders} className="px-3 py-1.5 text-xs font-semibold text-red-600">CLEAR ALL ORDERS</button>
          <button disabled={basketPositions.length === 0 || isPlacingOrders} onClick={handlePlaceAllOrders} className="px-3 py-1.5 text-xs font-semibold text-green-600 disabled:opacity-50">
            {isPlacingOrders ? 'PLACING...' : 'PLACE ALL ORDERS'}
          </button>
          <button onClick={() => setShowLoadDialog(true)} className="px-3 py-1.5 text-xs font-semibold text-blue-600">LOAD BASKET</button>
          <button onClick={() => setShowReadyBaskets(true)} className="px-3 py-1.5 text-xs font-semibold text-purple-600">READY BASKETS</button>
          <input
            type="text"
            placeholder="Basket name"
            value={currentBasketName}
            onChange={(e) => setCurrentBasketName(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          />
          <button onClick={handleSaveBasket} disabled={loading} className="px-3 py-1.5 text-xs font-semibold text-green-600 disabled:opacity-50">
            {loading ? 'SAVING...' : 'SAVE BASKET'}
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>

      {/* Load Basket Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Load Saved Basket</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedBaskets.map(basket => (
                <button
                  key={basket.id}
                  onClick={() => handleLoadBasket(basket)}
                  className="w-full text-left p-2 border rounded hover:bg-gray-50"
                >
                  <div className="font-medium">{basket.name}</div>
                  <div className="text-sm text-gray-600">{basket.positions.length} positions</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowLoadDialog(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
          </div>
        </div>
      )}

      {/* Ready Baskets Dialog */}
      {showReadyBaskets && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Ready Baskets</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dynamicReadyBaskets.map((basket, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadReadyBasket(basket)}
                  className="w-full text-left p-2 border rounded hover:bg-gray-50"
                >
                  <div className="font-medium">{basket.name}</div>
                  <div className="text-sm text-gray-600">{basket.description}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowReadyBaskets(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
          </div>
        </div>
      )}

      <div className="p-3 md:p-6 flex gap-4">
        <div className="flex-1 overflow-x-auto">
          <BasketOrderTable 
            positions={basketPositions} 
            onUpdatePosition={handleUpdatePosition} 
            onRemovePosition={handleRemovePosition} 
            expiry={expiry} 
            orderType={orderType}
            enableMultiBroker={true}
            onDistributeBasket={handleDistributeBasket}
          />
        </div>
        <div className="w-96">
          <OiPulsePayoffChart data={payoffData} metrics={metrics as any} currentSpot={metrics.currentSpot} />
        </div>
      </div>
    </div>
  )
}
