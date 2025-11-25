'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import React from 'react'
import { useMarket } from '@/components/market/market-context'
import SymbolSelect from './symbol-select'

export function TradeForm() {
  const [formData, setFormData] = useState({
    exchange: 'NSE',
    segment: 'Options',
    symbol: '',
    expiryDate: '',
    callStrike: '',
    putStrike: '',
    qty: '',
    productType: 'MARGIN',
    orderType: 'MARKET',
    marketProtection: '5',
    positionType: 'F&O positions only',
    positionView: 'All positions',
    predefinedSL: false,
    targetPrice: '',
    price: '',
    triggerPrice: '',
    oneClickEnabled: true,
  })

  const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
  const [availableStrikes, setAvailableStrikes] = useState<number[]>([])
  const [lotSize, setLotSize] = useState<number>(1)
  const [loadingExpiries, setLoadingExpiries] = useState(false)
  const [loadingStrikes, setLoadingStrikes] = useState(false)

  const market = useMarket()
  const currentTokenRef = React.useRef<string | null>(null)
  const currentExchangeRef = React.useRef<string>('NSE')

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Fetch lot size and expiries when symbol changes
  useEffect(() => {
    if (!formData.symbol) {
      setAvailableExpiries([])
      setLotSize(1)
      setFormData(prev => ({ ...prev, expiryDate: '', callStrike: '', putStrike: '', qty: '' }))
      return
    }

    const fetchSymbolData = async () => {
      setLoadingExpiries(true)
      const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
      try {
        // Fetch symbol details for lot size
        const url = `${BACKEND_BASE}/api/symbols/${encodeURIComponent(formData.symbol)}`
        console.log('[TradeForm] Fetching symbol data from:', url)
        const symbolResp = await fetch(url)
        console.log('[TradeForm] Symbol API status:', symbolResp.status, symbolResp.statusText)
        
        if (!symbolResp.ok) {
          console.error('[TradeForm] ❌ Symbol API error:', symbolResp.status, symbolResp.statusText)
          return
        }
        
        const symbolData = await symbolResp.json()
        console.log('[TradeForm] Symbol API response:', symbolData)
        
        if (symbolData.status && symbolData.data) {
          setLotSize(symbolData.data.lot_size || 1)
          setFormData(prev => ({ ...prev, qty: String(symbolData.data.lot_size || 1) }))

          // Subscribe to LTP feed for this symbol
          if (symbolData.data.token && market.subscribeTokens) {
            const exchange = symbolData.data.exchange || 'NSE'
            console.log('[TradeForm] Subscribing to token:', symbolData.data.token, 'for symbol:', formData.symbol, 'exchange:', exchange)
            market.subscribeTokens([{
              token: symbolData.data.token,
              exchange: exchange,
              symbol: formData.symbol,
            }])
            currentTokenRef.current = String(symbolData.data.token)
            currentExchangeRef.current = exchange
            console.log('[TradeForm] ✅ Subscribed to token:', currentTokenRef.current, 'exchange:', currentExchangeRef.current)
          } else {
            console.warn('[TradeForm] ⚠️ No token found for symbol:', formData.symbol, 'token:', symbolData.data?.token)
          }
        } else {
          console.error('[TradeForm] ❌ Invalid symbol data response:', symbolData)
        }

        // Fetch available expiries
        const expiryResp = await fetch(`${BACKEND_BASE}/api/symbols/${formData.symbol}/expiries`)
        const expiryData = await expiryResp.json()
        console.log('[TradeForm] Expiry API response:', expiryData)
        
        if (expiryData.status && expiryData.data && Array.isArray(expiryData.data)) {
          console.log('[TradeForm] Raw expiry dates:', expiryData.data)
          
          // Format expiry dates from ISO to DD-MMM-YYYY
          const formattedExpiries = expiryData.data.map((expiry: string) => {
            const date = new Date(expiry)
            const day = String(date.getDate()).padStart(2, '0')
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const month = monthNames[date.getMonth()]
            const year = date.getFullYear()
            return `${day}-${month}-${year}`
          })
          
          console.log('[TradeForm] Formatted expiry dates:', formattedExpiries)
          setAvailableExpiries(formattedExpiries)
          
          if (formattedExpiries.length > 0) {
            setFormData(prev => ({ ...prev, expiryDate: formattedExpiries[0] }))
          }
        } else {
          console.warn('[TradeForm] No expiry data available or invalid format')
          setAvailableExpiries([])
        }
      } catch (error) {
        console.error('Error fetching symbol data:', error)
      } finally {
        setLoadingExpiries(false)
      }
    }

    fetchSymbolData()
  }, [formData.symbol])

  // Fetch strikes when expiry changes
  useEffect(() => {
    if (!formData.symbol || !formData.expiryDate) {
      setAvailableStrikes([])
      return
    }

    const fetchStrikes = async () => {
      setLoadingStrikes(true)
      const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
      try {
        const resp = await fetch(`${BACKEND_BASE}/api/symbols/${formData.symbol}/expiries/${formData.expiryDate}/strikes`)
        const data = await resp.json()
        if (data.status && data.data) {
          setAvailableStrikes(data.data)
          if (data.data.length > 0) {
            const atmStrike = data.data[Math.floor(data.data.length / 2)] // ATM strike
            setFormData(prev => ({ ...prev, callStrike: String(atmStrike), putStrike: String(atmStrike) }))
          }
        }
      } catch (error) {
        console.error('Error fetching strikes:', error)
      } finally {
        setLoadingStrikes(false)
      }
    }

    fetchStrikes()
  }, [formData.symbol, formData.expiryDate])

  // Dispatch form updates to other components
  React.useEffect(() => {
    const eventData = { 
      ...formData, 
      token: currentTokenRef.current,
      exchange: currentExchangeRef.current 
    }
    window.dispatchEvent(new CustomEvent('tradeFormUpdated', { detail: eventData }))
  }, [formData])

  const TradeInputField = ({
    label,
    value,
    onChange,
    placeholder = '',
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent w-full"
      />
    </div>
  )

  const SelectField = ({
    label,
    value,
    onChange,
    options,
    loading = false,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    options: string[]
    loading?: boolean
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          {loading && options.length === 0 ? (
            <option>Loading...</option>
          ) : (
            options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Main Form Row - All fields in one compact row */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Exchange */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-gray-600">Exchange</label>
          <div className="relative">
            <select
              value={formData.exchange}
              onChange={(e) => handleChange('exchange', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {['BSE', 'NSE', 'MCX'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Segment */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-gray-600">Segment</label>
          <div className="relative">
            <select
              value={formData.segment}
              onChange={(e) => handleChange('segment', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {['Options', 'Futures', 'Cash'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Symbol */}
        <div className="flex flex-col gap-1 w-36">
          <label className="text-xs font-medium text-gray-600">Symbol</label>
          <SymbolSelect 
            value={formData.symbol} 
            onChange={(s) => handleChange('symbol', s)}
          />
        </div>

        {/* Expiry Date */}
        <div className="flex flex-col gap-1 w-32">
          <label className="text-xs font-medium text-gray-600">Expiry Date</label>
          <div className="relative">
            <select
              value={formData.expiryDate}
              onChange={(e) => handleChange('expiryDate', e.target.value)}
              disabled={loadingExpiries}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingExpiries && availableExpiries.length === 0 ? (
                <option>Loading...</option>
              ) : availableExpiries.length === 0 ? (
                <option value="">Select expiry</option>
              ) : (
                <>
                  {!formData.expiryDate && <option value="">Select expiry</option>}
                  {availableExpiries.map(option => <option key={option} value={option}>{option}</option>)}
                </>
              )}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Call Strike */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-gray-600">Call Strike</label>
          <div className="relative">
            <select
              value={formData.callStrike}
              onChange={(e) => handleChange('callStrike', e.target.value)}
              disabled={loadingStrikes}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingStrikes && availableStrikes.length === 0 ? (
                <option>Loading...</option>
              ) : availableStrikes.length === 0 ? (
                <option value="">Select</option>
              ) : (
                <>
                  {!formData.callStrike && <option value="">Select</option>}
                  {availableStrikes.map(strike => (
                    <option key={strike} value={String(strike)}>{strike}</option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Put Strike */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-gray-600">Put Strike</label>
          <div className="relative">
            <select
              value={formData.putStrike}
              onChange={(e) => handleChange('putStrike', e.target.value)}
              disabled={loadingStrikes}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingStrikes && availableStrikes.length === 0 ? (
                <option>Loading...</option>
              ) : availableStrikes.length === 0 ? (
                <option value="">Select</option>
              ) : (
                <>
                  {!formData.putStrike && <option value="">Select</option>}
                  {availableStrikes.map(strike => (
                    <option key={strike} value={String(strike)}>{strike}</option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Qty */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-xs font-medium text-gray-600">Qty (Lot: {lotSize})</label>
          <input
            type="text"
            value={formData.qty}
            onChange={(e) => handleChange('qty', e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Product Type Buttons */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Product Type</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleChange('productType', 'MARGIN')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                formData.productType === 'MARGIN'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              MARGIN
            </button>
            <button
              type="button"
              onClick={() => handleChange('productType', 'INTRADAY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                formData.productType === 'INTRADAY'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              INTRADAY
            </button>
          </div>
        </div>
      </div>

      {/* Order Type Buttons Row */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-gray-600">Order Type:</label>
        <button
          type="button"
          onClick={() => handleChange('orderType', 'LIMIT')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            formData.orderType === 'LIMIT'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          LIMIT
        </button>
        <button
          type="button"
          onClick={() => handleChange('orderType', 'MARKET')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            formData.orderType === 'MARKET'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          MARKET
        </button>
        <button
          type="button"
          onClick={() => handleChange('orderType', 'MARKET_PROTECTION')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            formData.orderType === 'MARKET_PROTECTION'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          MARKET PROTECTION
        </button>
        <button
          type="button"
          onClick={() => handleChange('orderType', 'SL-L')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            formData.orderType === 'SL-L'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          SL-L
        </button>
        <button
          type="button"
          onClick={() => handleChange('orderType', 'SL-M')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            formData.orderType === 'SL-M'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          SL-M
        </button>

        {/* Conditional Order Fields - Inline with buttons */}
        {formData.orderType === 'LIMIT' && (
          <input
            type="text"
            value={formData.price}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="Limit Price"
            className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {formData.orderType === 'SL-M' && (
          <input
            type="text"
            value={formData.triggerPrice}
            onChange={(e) => handleChange('triggerPrice', e.target.value)}
            placeholder="Trigger Price"
            className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {formData.orderType === 'SL-L' && (
          <>
            <input
              type="text"
              value={formData.triggerPrice}
              onChange={(e) => handleChange('triggerPrice', e.target.value)}
              placeholder="Trigger"
              className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="Limit"
              className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </>
        )}
        {formData.orderType === 'MARKET_PROTECTION' && (
          <input
            type="text"
            value={formData.marketProtection}
            onChange={(e) => handleChange('marketProtection', e.target.value)}
            placeholder="5"
            className="w-16 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}

        {/* Predefined SL inline */}
        <div className="flex items-center gap-1.5 ml-2">
          <input
            type="checkbox"
            id="predefinedSL"
            checked={formData.predefinedSL}
            onChange={(e) => handleChange('predefinedSL', e.target.checked)}
            className="w-4 h-4 border-gray-300 rounded cursor-pointer"
          />
          <label htmlFor="predefinedSL" className="text-xs text-gray-600 cursor-pointer">Predefined SL</label>
        </div>

        {/* Target Price inline */}
        <input
          type="text"
          value={formData.targetPrice}
          onChange={(e) => handleChange('targetPrice', e.target.value)}
          placeholder="Target (Pts)"
          className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Position Type */}
        <div className="relative">
          <select
            value={formData.positionType}
            onChange={(e) => handleChange('positionType', e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 pr-6"
          >
            {['F&O positions only', 'All positions'].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>

        {/* Position View */}
        <div className="relative">
          <select
            value={formData.positionView}
            onChange={(e) => handleChange('positionView', e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded appearance-none bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 pr-6"
          >
            {['All positions', 'Open positions', 'Closed positions'].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>

        {/* Show Options List */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('showOptionsChain', { detail: { symbol: formData.symbol, expiryDate: formData.expiryDate } }))} 
          className="px-3 py-1.5 text-red-600 border border-red-600 rounded text-xs font-medium hover:bg-red-50 transition-colors"
        >
          Show Options List
        </button>

        {/* One Click */}
        <div className="flex items-center gap-1.5">
          <input 
            type="checkbox" 
            id="oneClick"
            checked={formData.oneClickEnabled}
            onChange={(e) => handleChange('oneClickEnabled', e.target.checked)}
            className="w-4 h-4 border-gray-300 rounded cursor-pointer" 
          />
          <label htmlFor="oneClick" className="text-xs text-gray-600 cursor-pointer whitespace-nowrap">One click</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 italic">
        Changing type will reset all SL & Target
      </p>
    </div>
  )
}
