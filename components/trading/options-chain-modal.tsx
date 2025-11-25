'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, RefreshCw, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface OptionData {
  oiInt: string
  oiPercent: string
  oi: string
  iv: string
  ltpPercent: string
  ltpChg: string
  ltp: string
  action: 'B' | 'S'
  strike: string
  delta?: string
  gamma?: string
  theta?: string
  vega?: string
  intrinsic?: string
  extrinsic?: string
}

interface OptionChainData {
  calls: OptionData[]
  puts: OptionData[]
  spot: number
  timestamp: string
}

import { useMarket } from '@/components/market/market-context'
import { PlaceLimitOrderDialog } from './place-limit-order-dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function formatExpiryForSymbol(expiry: string) {
  // Accept '25-Nov-2025' and return '25-NOV-25'
  const parts = expiry.split('-')
  if (parts.length !== 3) return expiry
  const day = parts[0]
  const month = parts[1].toUpperCase()
  const year = parts[2].slice(-2)
  return `${day}-${month}-${year}`
}

export function OptionsChainModal({ isOpen, onClose, symbol, expiryDate }: { isOpen: boolean; onClose: () => void; symbol?: string; expiryDate?: string }) {
  const [selectedExpiry, setSelectedExpiry] = useState(expiryDate || '')
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
  const [scrollPosition, setScrollPosition] = useState(0)
  const [viewMode, setViewMode] = useState<'oi' | 'greeks' | 'premium'>('oi')
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [showLimitDialog, setShowLimitDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<{
    type: 'sell-call' | 'buy-call' | 'buy-put' | 'sell-put'
    symbol: string
    expiry?: string
    strike?: number
    cepe?: 'CE' | 'PE'
  } | null>(null)

  const market = useMarket()
  const currentSymbol = symbol || 'BANKNIFTY'
  const currentSpot = market?.symbols?.[currentSymbol]?.ltp || 47000

  // Fetch option chain data from live API
  const fetchOptionChain = async () => {
    setLoading(true)
    setError(null)
    try {
      const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
      
      // First, subscribe to underlying symbol for spot price
      if (currentSymbol && market.subscribeTokens) {
        try {
          const symbolResp = await fetch(`${BACKEND_BASE}/api/symbols/${encodeURIComponent(currentSymbol)}`)
          const symbolData = await symbolResp.json()
          if (symbolData.status && symbolData.data?.token) {
            market.subscribeTokens([{
              token: symbolData.data.token,
              exchange: symbolData.data.exchange || 'NSE',
              symbol: currentSymbol,
            }])
            console.log('[OptionsChain] Subscribed to underlying token:', symbolData.data.token)
          }
        } catch (e) {
          console.error('[OptionsChain] Error subscribing to underlying:', e)
        }
      }
      
      // Fetch real option chain from backend
      const expiryParam = selectedExpiry ? `?expiry=${encodeURIComponent(selectedExpiry)}` : ''
      const response = await fetch(`${BACKEND_BASE}/api/option-chain/${encodeURIComponent(currentSymbol)}${expiryParam}`)
      const result = await response.json()
      
      if (result.success && result.data && Array.isArray(result.data)) {
        // Transform backend data to component format
        const calls: OptionData[] = []
        const puts: OptionData[] = []
        const optionTokens: Array<{ token: string; exchange?: string; symbol?: string }> = []
        const expiryKey = formatExpiryForSymbol(selectedExpiry || '25-Nov-2025')
        
        result.data.forEach((item: any) => {
          const strike = item.strike_price?.toString() || '0'
          
          if (item.CE) {
            const quote = item.CE.marketData || {}
            const tokenSymbolKey = `${currentSymbol}-${expiryKey}-${strike}-CE`
            const oi = Number(quote.oi ?? item.CE.oi ?? 0)
            const netChange = Number(quote.netChange ?? 0)
            
            // OI Interpretation: ↑ if OI is high relative to volume (accumulation), ↓ if unwinding
            let oiInt = '—'
            if (oi > 0) {
              oiInt = netChange >= 0 ? '↑' : '↓'
            }
            
            // Extract IV and Greeks from API response
            const iv = item.CE.iv ?? quote.iv ?? 0
            const delta = item.CE.delta ?? quote.delta ?? 0
            const gamma = item.CE.gamma ?? quote.gamma ?? 0
            const theta = item.CE.theta ?? quote.theta ?? 0
            const vega = item.CE.vega ?? quote.vega ?? 0
            
            calls.push({
              strike,
              ltp: Number(quote.ltp ?? item.CE.ltp ?? 0).toFixed(2),
              ltpChg: Number(quote.netChange ?? 0).toFixed(2),
              ltpPercent: `${Number(quote.percentChange ?? 0).toFixed(2)}%`,
              oi: oi.toLocaleString(),
              oiPercent: quote.percentChange ? `${Number(quote.percentChange).toFixed(2)}%` : '0.00%',
              oiInt,
              iv: iv > 0 ? `${iv.toFixed(2)}%` : '—',
              action: 'B' as const,
              delta: delta !== 0 ? delta.toFixed(4) : '—',
              gamma: gamma !== 0 ? gamma.toFixed(6) : '—',
              theta: theta !== 0 ? theta.toFixed(2) : '—',
              vega: vega !== 0 ? vega.toFixed(2) : '—'
            })
            if (item.CE.token) {
              optionTokens.push({
                token: item.CE.token,
                exchange: item.CE.exchange || 'NFO',
                symbol: tokenSymbolKey,
              })
            }
          }
          
          if (item.PE) {
            const quote = item.PE.marketData || {}
            const tokenSymbolKey = `${currentSymbol}-${expiryKey}-${strike}-PE`
            const oi = Number(quote.oi ?? item.PE.oi ?? 0)
            const netChange = Number(quote.netChange ?? 0)
            
            // OI Interpretation
            let oiInt = '—'
            if (oi > 0) {
              oiInt = netChange >= 0 ? '↑' : '↓'
            }
            
            // Extract IV and Greeks from API response
            const iv = item.PE.iv ?? quote.iv ?? 0
            const delta = item.PE.delta ?? quote.delta ?? 0
            const gamma = item.PE.gamma ?? quote.gamma ?? 0
            const theta = item.PE.theta ?? quote.theta ?? 0
            const vega = item.PE.vega ?? quote.vega ?? 0
            
            puts.push({
              strike,
              ltp: Number(quote.ltp ?? item.PE.ltp ?? 0).toFixed(2),
              ltpChg: Number(quote.netChange ?? 0).toFixed(2),
              ltpPercent: `${Number(quote.percentChange ?? 0).toFixed(2)}%`,
              oi: oi.toLocaleString(),
              oiPercent: quote.percentChange ? `${Number(quote.percentChange).toFixed(2)}%` : '0.00%',
              oiInt,
              iv: iv > 0 ? `${iv.toFixed(2)}%` : '—',
              action: 'B' as const,
              delta: delta !== 0 ? delta.toFixed(4) : '—',
              gamma: gamma !== 0 ? gamma.toFixed(6) : '—',
              theta: theta !== 0 ? theta.toFixed(2) : '—',
              vega: vega !== 0 ? vega.toFixed(2) : '—'
            })
            if (item.PE.token) {
              optionTokens.push({
                token: item.PE.token,
                exchange: item.PE.exchange || 'NFO',
                symbol: tokenSymbolKey,
              })
            }
          }
        })
        
        setOptionChainData({
          calls,
          puts,
          spot: currentSpot,
          timestamp: new Date().toISOString()
        })
        
        // Subscribe to all option tokens for real-time LTP updates
        if (optionTokens.length > 0 && market.subscribeTokens) {
          market.subscribeTokens(optionTokens)
          console.log('[OptionsChain] Subscribed to', optionTokens.length, 'option tokens')
        }
      } else {
        // Show error if no data received
        setError('No option chain data available. Please check if market is open.')
        setOptionChainData(null)
      }
    } catch (error) {
      console.error('Error fetching option chain:', error)
      setError('Failed to fetch option chain data. Please try again.')
      setOptionChainData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchOptionChain()
    }
  }, [isOpen, currentSymbol, selectedExpiry])

  // Fetch available expiries when modal opens
  useEffect(() => {
    const fetchExpiries = async () => {
      try {
        const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
        const response = await fetch(`${BACKEND_BASE}/api/symbols/${encodeURIComponent(currentSymbol)}/expiries`)
        const result = await response.json()
        if (result.status && Array.isArray(result.data) && result.data.length > 0) {
          setAvailableExpiries(result.data)
          // Set first expiry as default if none selected
          if (!selectedExpiry || !result.data.includes(selectedExpiry)) {
            setSelectedExpiry(result.data[0])
          }
        }
      } catch (error) {
        console.error('Error fetching expiries:', error)
      }
    }
    if (isOpen && currentSymbol) {
      fetchExpiries()
    }
  }, [isOpen, currentSymbol])

  // Helper to resolve option LTP from market.symbols
  const resolveOptionLtp = (strike: string, side: 'CE' | 'PE') => {
    const formattedExpiry = formatExpiryForSymbol(selectedExpiry || '25-Nov-2025')
    const targetKey = `${currentSymbol}-${formattedExpiry}-${strike}-${side}`
    return market.symbols[targetKey]?.ltp
  }

  if (!isOpen) return null

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft)
  }

  const openLimitDialog = (orderType: 'sell-call' | 'buy-call' | 'buy-put' | 'sell-put', strike: string | number, side: 'CE' | 'PE') => {
    const formattedExpiry = formatExpiryForSymbol(selectedExpiry)
    const targetKey = `${currentSymbol}-${formattedExpiry}-${String(strike)}-${side}`
    setSelectedOrder({ type: orderType, symbol: targetKey, expiry: selectedExpiry, strike: Number(strike), cepe: side })
    setShowLimitDialog(true)
  }

  // We'll render a single table where each row contains CALL cells, STRIKE cell and PUT cells.
  // This ensures perfect vertical alignment between CALL / STRIKE / PUT across all rows.

  const renderCallCells = (data: OptionData, resolvedLtp: string, viewMode: typeof viewMode) => {
    if (viewMode === 'greeks') {
      return (
        <>
          <TableCell className="text-center">{data.delta}</TableCell>
          <TableCell className="text-center">{data.gamma}</TableCell>
          <TableCell className="text-center text-red-600">{data.theta}</TableCell>
          <TableCell className="text-center">{data.vega}</TableCell>
          <TableCell className="text-center">{data.iv}</TableCell>
          <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
          <TableCell className="text-center">{data.ltpChg}</TableCell>
          <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
          <TableCell className="text-center">
            <div className="inline-flex gap-2">
              <button
                onClick={() => openLimitDialog('buy-call', data.strike, 'CE')}
                className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
              >
                B
              </button>
              <button
                onClick={() => openLimitDialog('sell-call', data.strike, 'CE')}
                className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
              >
                S
              </button>
            </div>
          </TableCell>
        </>
      )
    }

    if (viewMode === 'premium') {
      const straddlePremium = (parseFloat(data.ltp) + parseFloat(optionChainData?.puts.find(p => p.strike === data.strike)?.ltp || '0')).toFixed(2)
      const totalPremium = (parseFloat(data.ltp) + parseFloat(data.extrinsic || '0')).toFixed(2)
      return (
        <>
          <TableCell className="text-center font-semibold">{straddlePremium}</TableCell>
          <TableCell className="text-center">{totalPremium}</TableCell>
          <TableCell className="text-center">{data.iv}</TableCell>
          <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
          <TableCell className="text-center">{data.ltpChg}</TableCell>
          <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
          <TableCell className="text-center">
            <div className="inline-flex gap-2">
              <button
                onClick={() => openLimitDialog('buy-call', data.strike, 'CE')}
                className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
              >
                B
              </button>
              <button
                onClick={() => openLimitDialog('sell-call', data.strike, 'CE')}
                className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
              >
                S
              </button>
            </div>
          </TableCell>
        </>
      )
    }

    // OI view
    return (
      <>
        <TableCell className={`text-center font-semibold ${data.oiInt === '↑' ? 'text-green-600' : data.oiInt === '↓' ? 'text-red-600' : 'text-blue-600'}`}>{data.oiInt}</TableCell>
        <TableCell className="text-center" style={{ color: data.oiPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.oiPercent}</TableCell>
        <TableCell className="text-center">{data.oi}</TableCell>
        <TableCell className="text-center">{data.iv}</TableCell>
        <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
        <TableCell className="text-center">{data.ltpChg}</TableCell>
        <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
        <TableCell className="text-center">
          <div className="inline-flex gap-2">
            <button
              onClick={() => openLimitDialog('buy-call', data.strike, 'CE')}
              className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
            >
              B
            </button>
            <button
              onClick={() => openLimitDialog('sell-call', data.strike, 'CE')}
              className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
            >
              S
            </button>
          </div>
        </TableCell>
      </>
    )
  }

  const renderPutCells = (data: OptionData, resolvedLtp: string, viewMode: typeof viewMode) => {
    if (viewMode === 'greeks') {
      return (
        <>
          <TableCell className="text-center">
            <div className="inline-flex gap-2">
              <button
                onClick={() => openLimitDialog('buy-put', data.strike, 'PE')}
                className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
              >
                B
              </button>
              <button
                onClick={() => openLimitDialog('sell-put', data.strike, 'PE')}
                className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
              >
                S
              </button>
            </div>
          </TableCell>
          <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
          <TableCell className="text-center">{data.ltpChg}</TableCell>
          <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
          <TableCell className="text-center">{data.iv}</TableCell>
          <TableCell className="text-center">{data.delta}</TableCell>
          <TableCell className="text-center">{data.gamma}</TableCell>
          <TableCell className="text-center text-red-600">{data.theta}</TableCell>
          <TableCell className="text-center">{data.vega}</TableCell>
        </>
      )
    }

    if (viewMode === 'premium') {
      const totalPremium = (parseFloat(data.ltp) + parseFloat(data.extrinsic || '0')).toFixed(2)
      const intrinsicValue = data.intrinsic || '0'
      const straddlePremium = (parseFloat(optionChainData?.calls.find(c => c.strike === data.strike)?.ltp || '0') + parseFloat(data.ltp)).toFixed(2)
      return (
        <>
          <TableCell className="text-center">
            <div className="inline-flex gap-2">
              <button
                onClick={() => openLimitDialog('buy-put', data.strike, 'PE')}
                className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
              >
                B
              </button>
              <button
                onClick={() => openLimitDialog('sell-put', data.strike, 'PE')}
                className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
              >
                S
              </button>
            </div>
          </TableCell>
          <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
          <TableCell className="text-center">{data.ltpChg}</TableCell>
          <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
          <TableCell className="text-center">{data.iv}</TableCell>
          <TableCell className="text-center">{totalPremium}</TableCell>
          <TableCell className="text-center font-semibold">{straddlePremium}</TableCell>
        </>
      )
    }

    // OI view
    return (
      <>
        <TableCell className="text-center">
          <div className="inline-flex gap-2">
            <button
              onClick={() => openLimitDialog('buy-put', data.strike, 'PE')}
              className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs"
            >
              B
            </button>
            <button
              onClick={() => openLimitDialog('sell-put', data.strike, 'PE')}
              className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
            >
              S
            </button>
          </div>
        </TableCell>
        <TableCell className="text-center font-semibold">{resolvedLtp}</TableCell>
        <TableCell className="text-center">{data.ltpChg}</TableCell>
        <TableCell className="text-center" style={{ color: data.ltpPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.ltpPercent}</TableCell>
        <TableCell className="text-center">{data.iv}</TableCell>
        <TableCell className="text-center">{data.oi}</TableCell>
        <TableCell className="text-center" style={{ color: data.oiPercent.includes('-') ? '#dc2626' : '#16a34a' }}>{data.oiPercent}</TableCell>
        <TableCell className={`text-center font-semibold ${data.oiInt === '↑' ? 'text-green-600' : data.oiInt === '↓' ? 'text-red-600' : 'text-blue-600'}`}>{data.oiInt}</TableCell>
      </>
    )
  }
  
  

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-0 overflow-y-auto">
      <div className="bg-white w-full h-screen max-w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <button onClick={onClose} aria-label="Close options" className="text-red-600 text-2xl hover:text-red-700">✕</button>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Expiry Date</label>
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="px-3 py-1 text-xs border border-gray-300 rounded"
              >
                {availableExpiries.length > 0 ? (
                  availableExpiries.map((expiry) => (
                    <option key={expiry} value={expiry}>{expiry}</option>
                  ))
                ) : (
                  <option value="">Loading expiries...</option>
                )}
              </select>
            </div>

            {/* View Mode Tabs */}
            <div className="flex bg-gray-100 rounded p-1">
              <button
                onClick={() => setViewMode('oi')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'oi' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                OI
              </button>
              <button
                onClick={() => setViewMode('greeks')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'greeks' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Greeks
              </button>
              <button
                onClick={() => setViewMode('premium')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'premium' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Premium
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Subscribe Tokens</label>
              <input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="comma separated token ids"
                className="px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <button
                onClick={() => {
                  if (!tokenInput) return
                  const tokens = tokenInput.split(',').map(s => s.trim()).filter(Boolean)
                  if (tokens.length === 0) return
                  market.subscribeTokens?.(tokens)
                  setTokenInput('')
                }}
                className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700"
              >
                Subscribe
              </button>
            </div>

            <button
              onClick={fetchOptionChain}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>

            <button className="px-2 py-1 border border-red-600 text-red-600 text-xs font-semibold rounded hover:bg-red-50">
              SHOW OI
            </button>
          </div>

          <div className="text-xs text-gray-600">
            <span className="text-right block">
              Underlying: <span className="font-semibold">{currentSymbol} at {currentSpot.toFixed(2)},</span> Chg: <span className="text-green-600">—</span>
            </span>
            <span className="text-right block">Add to basket</span>
          </div>
        </div>

        {/* Table Content: single aligned table */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center justify-center gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading option chain data...</span>
            </div>
          )}

          {/* No data state */}
          {!loading && !error && !optionChainData && (
            <div className="flex items-center justify-center p-8 text-gray-500">
              No option chain data available. Select an expiry date to load options.
            </div>
          )}

          {/* Market data note */}
          {!loading && optionChainData && (
            <div className="text-xs text-gray-500 mb-2 text-center">
              💡 LTP, OI data from Smart API. IV and OI Change require additional data sources not available in basic quotes.
            </div>
          )}

          {/* Option chain table */}
          {!loading && optionChainData && (
          <div className="w-full">
            <div className="bg-white border border-gray-200 shadow-sm rounded">
              <div className="px-3 py-2 bg-gray-100 font-semibold text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">CALL</div>
                <div className="text-center w-28">Strike</div>
                <div className="flex items-center gap-2">PUT</div>
              </div>

              <div className="overflow-x-auto">
                <Table className="min-w-[1200px] table-fixed">
                  <TableHeader>
                    <tr>
                      {/* CALL headers */}
                      {viewMode === 'oi' && (
                        <>
                          <TableHead className="text-center">OI Int.</TableHead>
                          <TableHead className="text-center">OI %</TableHead>
                          <TableHead className="text-center">OI</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </>
                      )}
                      {viewMode === 'greeks' && (
                        <>
                          <TableHead className="text-center">Delta</TableHead>
                          <TableHead className="text-center">Gamma</TableHead>
                          <TableHead className="text-center">Theta</TableHead>
                          <TableHead className="text-center">Vega</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </>
                      )}
                      {viewMode === 'premium' && (
                        <>
                          <TableHead className="text-center">Straddle</TableHead>
                          <TableHead className="text-center">Premium</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </>
                      )}

                      {/* Strike header */}
                      <TableHead className="text-center">Strike</TableHead>

                      {/* PUT headers (mirror) */}
                      {viewMode === 'oi' && (
                        <>
                          <TableHead className="text-center">Action</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">OI</TableHead>
                          <TableHead className="text-center">OI %</TableHead>
                          <TableHead className="text-center">OI Int.</TableHead>
                        </>
                      )}
                      {viewMode === 'greeks' && (
                        <>
                          <TableHead className="text-center">Action</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">Delta</TableHead>
                          <TableHead className="text-center">Gamma</TableHead>
                          <TableHead className="text-center">Theta</TableHead>
                          <TableHead className="text-center">Vega</TableHead>
                        </>
                      )}
                      {viewMode === 'premium' && (
                        <>
                          <TableHead className="text-center">Action</TableHead>
                          <TableHead className="text-center">LTP</TableHead>
                          <TableHead className="text-center">LTP Chg</TableHead>
                          <TableHead className="text-center">LTP %</TableHead>
                          <TableHead className="text-center">IV</TableHead>
                          <TableHead className="text-center">Premium</TableHead>
                          <TableHead className="text-center">Straddle</TableHead>
                        </>
                      )}
                    </tr>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[68vh] overflow-auto">
                <Table className="min-w-[1200px] table-fixed">
                  <TableBody>
                    {optionChainData?.calls.map((call, i) => {
                      const put = optionChainData?.puts[i]
                      const callLtp = resolveOptionLtp(call.strike, 'CE') ?? call.ltp
                      const putLtp = resolveOptionLtp(put?.strike || call.strike, 'PE') ?? put?.ltp ?? ''
                      const isNearest = Math.abs(Number(call.strike) - currentSpot) < (currentSymbol.includes('BANKNIFTY') ? 200 : 10)
                      return (
                        <TableRow key={i} className={`${isNearest ? 'bg-yellow-50 font-semibold' : ''}`}>
                          {/* CALL cells */}
                          {renderCallCells(call, callLtp, viewMode)}

                          {/* Strike */}
                          <TableCell className="text-center bg-amber-50">{call.strike}</TableCell>

                          {/* PUT cells */}
                          {put && renderPutCells(put, putLtp, viewMode)}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          )}
        </div>
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
          expiry={selectedOrder.expiry}
          strike={selectedOrder.strike}
          cepe={selectedOrder.cepe}
        />
      )}
    </div>
  )
}
