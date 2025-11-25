"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Square, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface BasketPosition {
  id: string
  symbol: string
  expiry: string
  strike: number
  cepe: 'CE' | 'PE'
  qty: number
  type: 'MKT' | 'LIMIT'
  price: number
  ltp?: number
  brokerId?: number
}

interface Broker {
  id: number
  name: string
  broker_type: string
  is_active: boolean
}

interface BasketOrder {
  id: number
  basket_name: string
  basket_type: string
  total_quantity: number
  total_value: number
  status: 'pending' | 'executing' | 'partial' | 'completed' | 'failed' | 'cancelled'
  distribution_algorithm: string
  max_brokers: number
  created_at: string
  updated_at: string
  completed_at?: string
  items_count?: number
  executed_items?: number
  failed_items?: number
}

interface BasketExecutionProgress {
  overall: {
    total_items: number
    executed_items: number
    failed_items: number
    executing_items: number
    pending_items: number
    assigned_items: number
  }
  byBroker: Array<{
    broker_name: string
    total_items: number
    executed_items: number
    failed_items: number
    executing_items: number
  }>
}

interface BasketOrderTableProps {
  positions: BasketPosition[]
  onUpdatePosition: (id: string, updates: Partial<BasketPosition>) => void
  onRemovePosition: (id: string) => void
  expiry?: string
  orderType?: 'MKT' | 'LIMIT'
  enableMultiBroker?: boolean
  onDistributeBasket?: (algorithm: string, maxBrokers: number) => void
  onCreateBasketOrder?: (basketData: any) => Promise<void>
  onExecuteBasketOrder?: (basketId: number) => Promise<void>
  onCancelBasketOrder?: (basketId: number) => Promise<void>
}

const AVAILABLE_EXPIRIES = [
  '25-Nov-2025',
  '26-Nov-2025',
  '27-Nov-2025',
  '28-Nov-2025',
  '29-Nov-2025',
  '30-Nov-2025'
]

export function BasketOrderTable({
  positions,
  onUpdatePosition,
  onRemovePosition,
  expiry = '25-Nov-2025',
  orderType = 'MKT',
  enableMultiBroker = false,
  onDistributeBasket,
  onCreateBasketOrder,
  onExecuteBasketOrder,
  onCancelBasketOrder
}: BasketOrderTableProps) {
  const [availableExpiries, setAvailableExpiries] = useState<string[]>(AVAILABLE_EXPIRIES)
  const [availableStrikes, setAvailableStrikes] = useState<Record<string, number[]>>({})
  const [loadingExpiries, setLoadingExpiries] = useState<Record<string, boolean>>({})
  const [loadingStrikes, setLoadingStrikes] = useState<Record<string, boolean>>({})
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loadingBrokers, setLoadingBrokers] = useState(false)
  const [distributionAlgorithm, setDistributionAlgorithm] = useState('round-robin')
  const [maxBrokers, setMaxBrokers] = useState(2)

  // Basket order management state
  const [basketOrders, setBasketOrders] = useState<BasketOrder[]>([])
  const [selectedBasket, setSelectedBasket] = useState<BasketOrder | null>(null)
  const [executionProgress, setExecutionProgress] = useState<BasketExecutionProgress | null>(null)
  const [showBasketDialog, setShowBasketDialog] = useState(false)
  const [basketName, setBasketName] = useState('')
  const [executingBaskets, setExecutingBaskets] = useState<Set<number>>(new Set())
  const [progressIntervals, setProgressIntervals] = useState<Map<number, NodeJS.Timeout>>(new Map())

  

  const fetchBrokers = async () => {
    if (!enableMultiBroker) return
    setLoadingBrokers(true)
    try {
      const res = await fetch('http://localhost:5000/api/brokers')
      const data = await res.json()
      if (data?.status && data?.data) {
        setBrokers(data.data.filter((b: Broker) => b.is_active))
      }
    } catch (err) {
      console.error('Error fetching brokers', err)
    } finally {
      setLoadingBrokers(false)
    }
  }

  useEffect(() => {
    if (enableMultiBroker) {
      fetchBrokers()
    }
  }, [enableMultiBroker])

  const fetchExpiries = async (symbol: string) => {
    if (!symbol) return
    if (loadingExpiries[symbol]) return
    setLoadingExpiries(prev => ({ ...prev, [symbol]: true }))
    try {
      const res = await fetch(`http://localhost:5000/api/symbols/${symbol}/expiries`)
      const data = await res.json()
      if (data?.status && data?.data) {
        setAvailableExpiries(prev => {
          const merged = Array.from(new Set([...prev, ...data.data]))
          return merged.sort()
        })
      }
    } catch (err) {
      console.error('Error fetching expiries', err)
    } finally {
      setLoadingExpiries(prev => ({ ...prev, [symbol]: false }))
    }
  }

  const fetchStrikes = async (symbol: string, expiryStr: string) => {
    if (!symbol || !expiryStr) return
    const key = `${symbol}-${expiryStr}`
    if (loadingStrikes[key]) return
    setLoadingStrikes(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch(`http://localhost:5000/api/symbols/${symbol}/expiries/${encodeURIComponent(expiryStr)}/strikes`)
      const data = await res.json()
      if (data?.status && data?.data) {
        setAvailableStrikes(prev => ({ ...prev, [key]: data.data.sort((a: number, b: number) => a - b) }))
      }
    } catch (err) {
      console.error('Error fetching strikes', err)
    } finally {
      setLoadingStrikes(prev => ({ ...prev, [key]: false }))
    }
  }

  const getAvailableStrikes = (symbol: string, expiryStr: string) => {
    const key = `${symbol}-${expiryStr}`
    return availableStrikes[key] || []
  }

  const handleExpiryChange = (id: string, symbol: string, newExpiry: string) => {
    onUpdatePosition(id, { expiry: newExpiry })
    fetchStrikes(symbol, newExpiry)
  }

  const handleSymbolChange = (id: string, newSymbol: string) => {
    onUpdatePosition(id, { symbol: newSymbol })
    fetchExpiries(newSymbol)
    const pos = positions.find(p => p.id === id)
    if (pos) fetchStrikes(newSymbol, pos.expiry)
  }

  const handleStrikeChange = (id: string, delta: number) => {
    const pos = positions.find(p => p.id === id)
    if (!pos) return
    const strikes = getAvailableStrikes(pos.symbol, pos.expiry)
    if (strikes.length > 0) {
      let idx = strikes.indexOf(pos.strike)
      if (idx === -1) {
        idx = strikes.reduce((closest, s, i) => Math.abs(s - pos.strike) < Math.abs(strikes[closest] - pos.strike) ? i : closest, 0)
      }
      const newIdx = Math.max(0, Math.min(strikes.length - 1, idx + delta))
      onUpdatePosition(id, { strike: strikes[newIdx] })
    } else {
      const newStrike = Math.max(1000, pos.strike + delta * 100)
      onUpdatePosition(id, { strike: newStrike })
    }
  }

  const handleQtyChange = (id: string, delta: number) => {
    const pos = positions.find(p => p.id === id)
    if (!pos) return
    const newQty = Math.max(1, pos.qty + delta)
    onUpdatePosition(id, { qty: newQty })
  }

  useEffect(() => {
    const uniqueSymbols = Array.from(new Set(positions.map(p => p.symbol))).filter(Boolean)
    uniqueSymbols.forEach(sym => {
      if (!availableExpiries.some(e => e.includes(sym))) fetchExpiries(sym)
    })

    positions.forEach(p => {
      const key = `${p.symbol}-${p.expiry}`
      if (p.symbol && p.expiry && !availableStrikes[key]) fetchStrikes(p.symbol, p.expiry)
    })
  }, [positions])

  // Basket order management functions
  const fetchBasketOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/basket-orders')
      const data = await res.json()
      if (data.status) {
        setBasketOrders(data.data)
      }
    } catch (error) {
      console.error('Error fetching basket orders:', error)
    }
  }

  const createBasketOrder = async () => {
    if (!basketName.trim() || positions.length === 0) {
      toast.error('Please provide a basket name and add positions')
      return
    }

    const basketData = {
      name: basketName,
      type: 'options',
      distributionAlgorithm,
      maxBrokers,
      items: positions.map(pos => ({
        symbol: pos.symbol,
        expiry: pos.expiry,
        strike: pos.strike,
        optionType: pos.cepe,
        quantity: pos.qty,
        orderType: pos.type,
        price: pos.type === 'LIMIT' ? pos.price : null,
        triggerPrice: null,
        transactionType: 'BUY', // Default to BUY, can be enhanced
        productType: 'MIS',
        brokerId: pos.brokerId
      }))
    }

    try {
      if (onCreateBasketOrder) {
        await onCreateBasketOrder(basketData)
      } else {
        const res = await fetch('http://localhost:5000/api/basket-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basketData)
        })
        const data = await res.json()
        if (data.status) {
          toast.success('Basket order created successfully')
          setShowBasketDialog(false)
          setBasketName('')
          fetchBasketOrders()
        } else {
          toast.error('Failed to create basket order')
        }
      }
    } catch (error) {
      console.error('Error creating basket order:', error)
      toast.error('Failed to create basket order')
    }
  }

  const executeBasketOrder = async (basketId: number) => {
    try {
      setExecutingBaskets(prev => new Set(prev).add(basketId))

      if (onExecuteBasketOrder) {
        await onExecuteBasketOrder(basketId)
      } else {
        const res = await fetch(`http://localhost:5000/api/basket-orders/${basketId}/execute`, {
          method: 'POST'
        })
        const data = await res.json()
        if (data.status) {
          toast.success('Basket execution started')
          fetchBasketOrders()
          // Start progress monitoring
          startProgressMonitoring(basketId)
        } else {
          toast.error('Failed to start basket execution')
        }
      }
    } catch (error) {
      console.error('Error executing basket order:', error)
      toast.error('Failed to execute basket order')
    } finally {
      setExecutingBaskets(prev => {
        const newSet = new Set(prev)
        newSet.delete(basketId)
        return newSet
      })
    }
  }

  const cancelBasketOrder = async (basketId: number) => {
    try {
      if (onCancelBasketOrder) {
        await onCancelBasketOrder(basketId)
      } else {
        const res = await fetch(`http://localhost:5000/api/basket-orders/${basketId}/cancel`, {
          method: 'PUT'
        })
        const data = await res.json()
        if (data.status) {
          toast.success('Basket order cancelled')
          fetchBasketOrders()
          stopProgressMonitoring(basketId)
        } else {
          toast.error('Failed to cancel basket order')
        }
      }
    } catch (error) {
      console.error('Error cancelling basket order:', error)
      toast.error('Failed to cancel basket order')
    }
  }

  const startProgressMonitoring = (basketId: number) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/basket-orders/${basketId}/progress`)
        const data = await res.json()
        if (data.status) {
          setExecutionProgress(data.data)
          // Stop monitoring if execution is complete
          const progress = data.data.overall
          if (progress.executing_items === 0 && progress.pending_items === 0 && progress.assigned_items === 0) {
            stopProgressMonitoring(basketId)
            fetchBasketOrders() // Refresh basket status
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error)
      }
    }, 2000) // Update every 2 seconds

    setProgressIntervals(prev => new Map(prev).set(basketId, interval))
  }

  const stopProgressMonitoring = (basketId: number) => {
    const interval = progressIntervals.get(basketId)
    if (interval) {
      clearInterval(interval)
      setProgressIntervals(prev => {
        const newMap = new Map(prev)
        newMap.delete(basketId)
        return newMap
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'executing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'partial': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'cancelled': return <Square className="h-4 w-4 text-gray-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'executing': return 'bg-blue-100 text-blue-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  useEffect(() => {
    if (enableMultiBroker) {
      fetchBasketOrders()
    }
    // Cleanup intervals on unmount
    return () => {
      progressIntervals.forEach(interval => clearInterval(interval))
    }
  }, [enableMultiBroker])

  return (
    <div className="space-y-6">
      {/* Original Basket Order Table */}

      {/* Original Basket Order Table */}
      <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left px-2 py-2 font-semibold text-gray-700 w-6">
            <input type="checkbox" className="rounded" />
          </th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Symbol</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Expiry</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Strike</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">CE/PE</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Qty</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Type</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Price</th>
          <th className="text-left px-2 py-2 font-semibold text-gray-700">LTP</th>
          {enableMultiBroker && (
            <th className="text-left px-2 py-2 font-semibold text-gray-700">Broker</th>
          )}
          <th className="text-left px-2 py-2 font-semibold text-gray-700">Action</th>
        </tr>
      </thead>
      <tbody>
        {(positions || []).map(pos => (
          <tr key={pos.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td className="px-2 py-2">
              <input type="checkbox" className="rounded" />
            </td>
            <td className="px-2 py-2 font-semibold text-red-600">
              <input
                type="text"
                value={pos.symbol}
                onChange={(e) => handleSymbolChange(pos.id, e.target.value.toUpperCase())}
                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-red-500"
                placeholder="SYMBOL"
              />
            </td>
            <td className="px-2 py-2">
              <select
                value={pos.expiry}
                onChange={(e) => handleExpiryChange(pos.id, pos.symbol, e.target.value)}
                className="px-1 py-0.5 border border-gray-300 rounded text-xs hover:border-gray-400 focus:outline-none focus:border-red-500"
              >
                {availableExpiries.map(exp => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </select>
            </td>
            <td className="px-2 py-2">
              <div className="flex items-center gap-1">
                <button onClick={() => handleStrikeChange(pos.id, -1)} className="px-1 hover:bg-gray-200 rounded">−</button>
                <span className="px-2 py-0.5 border border-gray-300 rounded text-xs min-w-12 text-center">{pos.strike}</span>
                <button onClick={() => handleStrikeChange(pos.id, 1)} className="px-1 hover:bg-gray-200 rounded">+</button>
              </div>
            </td>
            <td className="px-2 py-2 font-semibold">{pos.cepe}</td>
            <td className="px-2 py-2">
              <div className="flex items-center gap-1">
                <button onClick={() => handleQtyChange(pos.id, -1)} className="px-1 hover:bg-gray-200 rounded">−</button>
                <span className="px-2 py-0.5 border border-gray-300 rounded text-xs min-w-10 text-center">{pos.qty}</span>
                <button onClick={() => handleQtyChange(pos.id, 1)} className="px-1 hover:bg-gray-200 rounded">+</button>
              </div>
            </td>
            <td className="px-2 py-2">
              <select
                value={pos.type}
                onChange={(e) => onUpdatePosition(pos.id, { type: e.target.value as 'MKT' | 'LIMIT' })}
                className="px-1 py-0.5 border border-gray-300 rounded text-xs hover:border-gray-400 focus:outline-none focus:border-red-500"
              >
                <option value="MKT">MKT</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </td>
            <td className="px-2 py-2">
              <input
                type="number"
                value={pos.price}
                onChange={(e) => onUpdatePosition(pos.id, { price: parseFloat(e.target.value) || 0 })}
                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-red-500"
              />
            </td>
            <td className="px-2 py-2 text-gray-600">{typeof pos.ltp === 'number' ? pos.ltp.toFixed(2) : '-'}</td>
            {enableMultiBroker && (
              <td className="px-2 py-2">
                <select
                  value={pos.brokerId || ''}
                  onChange={(e) => onUpdatePosition(pos.id, { brokerId: parseInt(e.target.value) || undefined })}
                  className="px-1 py-0.5 border border-gray-300 rounded text-xs hover:border-gray-400 focus:outline-none focus:border-red-500"
                >
                  <option value="">Auto</option>
                  {brokers.map(broker => (
                    <option key={broker.id} value={broker.id}>{broker.name}</option>
                  ))}
                </select>
              </td>
            )}
            <td className="px-2 py-2">
              <button onClick={() => onRemovePosition(pos.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Remove</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {enableMultiBroker && onDistributeBasket && positions.length > 0 && (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-800 mb-3">Multi-Broker Distribution</h4>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-blue-700">Algorithm:</label>
            <select
              value={distributionAlgorithm}
              onChange={(e) => setDistributionAlgorithm(e.target.value)}
              className="px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="round-robin">Round Robin</option>
              <option value="load-balance">Load Balance</option>
              <option value="priority">Priority</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-blue-700">Max Brokers:</label>
            <input
              type="number"
              min="1"
              max={brokers.length}
              value={maxBrokers}
              onChange={(e) => setMaxBrokers(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => onDistributeBasket?.(distributionAlgorithm, maxBrokers)}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Distribute Basket
          </button>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Distribute basket orders across multiple brokers using the selected algorithm.
          Orders without specific broker assignment will be auto-distributed.
        </p>
      </div>
    )}
    </div>
  )
}

// Removed local handleRemovePosition; parent handles removal via onRemovePosition
