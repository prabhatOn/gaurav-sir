'use client'

import { useState, useEffect } from 'react'

interface Holding {
  symboltoken: string
  symbolname: string
  producttype: string
  quantity: number
  avgnetprice: number
  ltp: number
  pnl: number
  unrealised: number
  realised: number
  broker_id?: number
  brokerId?: number
}

interface Broker {
  id: number
  name: string
  broker_type: string
  is_active: boolean
}

export function HoldingsTable({ onTotalsChange, disableFetch }: { onTotalsChange?: (t: { totalPnl: number; investedValue: number; marketValue: number }) => void, disableFetch?: boolean }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [selectedBrokerId, setSelectedBrokerId] = useState<number | null>(null)
  const [loadingBrokers, setLoadingBrokers] = useState(false)

  useEffect(() => {
    if (disableFetch) {
      // Avoid touching remote API during development; show empty UI instead
      setHoldings([])
      setLoading(false)
      setError(null)
      // Report empty totals
      onTotalsChange?.({ totalPnl: 0, investedValue: 0, marketValue: 0 })
      return
    }
    fetchHoldings()
    fetchBrokers()
  }, [disableFetch])

  useEffect(() => {
    if (!disableFetch) {
      fetchHoldings()
    }
  }, [selectedBrokerId])

  const fetchBrokers = async () => {
    setLoadingBrokers(true)
    try {
      const response = await fetch('http://localhost:5000/api/brokers')
      const data = await response.json()
      if (data.status && data.data) {
        setBrokers(data.data.filter((b: Broker) => b.is_active))
      }
    } catch (error) {
      console.error('Error fetching brokers:', error)
    } finally {
      setLoadingBrokers(false)
    }
  }

  const fetchHoldings = async () => {
    try {
      setLoading(true)
      const url = selectedBrokerId 
        ? `http://localhost:5000/api/holdings?brokerId=${selectedBrokerId}`
        : 'http://localhost:5000/api/holdings'
      const response = await fetch(url)
      const data = await response.json()

      if (data.status && data.data) {
        const holdingsWithBroker = data.data.map((h: any) => ({
          ...h,
          quantity: parseFloat(h.quantity) || 0,
          avgnetprice: parseFloat(h.avgnetprice) || 0,
          ltp: parseFloat(h.ltp) || 0,
          pnl: parseFloat(h.pnl) || 0,
          unrealised: parseFloat(h.unrealised) || 0,
          realised: parseFloat(h.realised) || 0,
          brokerId: h.broker_id ?? h.brokerId
        }))
        setHoldings(holdingsWithBroker)

        // Compute totals and report to parent
        const totalPnl = data.data.reduce((sum: number, h: Holding) => sum + (h.pnl || 0), 0)
        const investedValue = data.data.reduce((sum: number, h: Holding) => sum + ((h.quantity || 0) * (h.avgnetprice || 0)), 0)
        const marketValue = data.data.reduce((sum: number, h: Holding) => sum + ((h.quantity || 0) * (h.ltp || 0)), 0)
        onTotalsChange?.({ totalPnl, investedValue, marketValue })
      } else {
        setHoldings([])
        setError('Failed to fetch holdings')
        onTotalsChange?.({ totalPnl: 0, investedValue: 0, marketValue: 0 })
      }
    } catch (err) {
      setError('Error fetching holdings')
      console.error('Error fetching holdings:', err)
      onTotalsChange?.({ totalPnl: 0, investedValue: 0, marketValue: 0 })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="overflow-x-auto h-full bg-white">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading holdings...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="overflow-x-auto h-full bg-white">
        <div className="flex items-center justify-center h-32">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto h-full bg-white">
      {/* Broker Filter */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Broker:</label>
            <select
              value={selectedBrokerId || ''}
              onChange={(e) => setSelectedBrokerId(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Brokers</option>
              {brokers.map(broker => (
                <option key={broker.id} value={broker.id}>{broker.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchHoldings()}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Symbol</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Qty</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Avg Price</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">LTP</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Unrealised</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Realised</th>
          </tr>
        </thead>
        <tbody>
          {holdings.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-12 text-center text-gray-500 text-xs">
                No Holdings To Show
              </td>
            </tr>
          ) : (
            holdings.map((holding, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{holding.symbolname}</td>
                <td className="px-3 py-2">{holding.producttype}</td>
                <td className="px-3 py-2">{holding.quantity}</td>
                <td className="px-3 py-2">{typeof holding.avgnetprice === 'number' ? holding.avgnetprice.toFixed(2) : '-'}</td>
                <td className="px-3 py-2">{typeof holding.ltp === 'number' ? holding.ltp.toFixed(2) : '-'}</td>
                <td className={`px-3 py-2 ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {typeof holding.pnl === 'number' ? holding.pnl.toFixed(2) : '-'}
                </td>
                <td className={`px-3 py-2 ${holding.unrealised >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {typeof holding.unrealised === 'number' ? holding.unrealised.toFixed(2) : '-'}
                </td>
                <td className={`px-3 py-2 ${holding.realised >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {typeof holding.realised === 'number' ? holding.realised.toFixed(2) : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}