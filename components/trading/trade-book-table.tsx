'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Trade {
  tradeid?: string
  symbolname?: string
  producttype?: string
  side?: string
  avgprice?: number
  netqty?: number
  tradetime?: string
}

export function TradeBookTable({ disableFetch }: { disableFetch?: boolean }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brokers, setBrokers] = useState<any[]>([])
  const [selectedBrokerId, setSelectedBrokerId] = useState<number | null>(null)

  useEffect(() => {
    if (disableFetch) {
      // Do not hit remote API in development; show empty state instead
      setTrades([])
      setLoading(false)
      setError(null)
      return
    }
    fetchBrokers()
    fetchTrades()
  }, [disableFetch])

  useEffect(() => {
    if (!disableFetch) {
      fetchTrades()
    }
  }, [selectedBrokerId, disableFetch])

  const fetchTrades = async () => {
    try {
      setLoading(true)
      const url = selectedBrokerId 
        ? `http://localhost:5000/api/trades?brokerId=${selectedBrokerId}`
        : 'http://localhost:5000/api/trades'
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status && data.data) {
        setTrades(data.data)
      } else {
        setError('Failed to fetch trades')
      }
    } catch (err) {
      setError('Error fetching trades')
      console.error('Error fetching trades:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBrokers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/brokers')
      const data = await response.json()
      if (data.status && data.data) {
        setBrokers(data.data)
      }
    } catch (err) {
      console.error('Error fetching brokers:', err)
    }
  }

  if (loading) {
    return (
      <div className="overflow-x-auto h-full bg-white">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading trades...</div>
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
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Label htmlFor="broker-select" className="text-sm font-medium">Filter by Broker:</Label>
          <Select 
            value={selectedBrokerId?.toString() || 'all'} 
            onValueChange={(value) => setSelectedBrokerId(value === 'all' ? null : parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Brokers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brokers</SelectItem>
              {brokers.map((broker) => (
                <SelectItem key={broker.id} value={broker.id.toString()}>
                  {broker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <table className="w-full text-xs min-w-max whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Symbol Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Product Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Side</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Avg Price</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Net Qty</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Time/Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Order Id</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-12 text-center text-gray-500 text-xs">
                No Trades To Show
              </td>
            </tr>
          ) : (
            trades.map((trade, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{trade.symbolname ?? '-'}</td>
                <td className="px-4 py-3">{trade.producttype ?? '-'}</td>
                <td className="px-4 py-3">{trade.side ?? '-'}</td>
                <td className="px-4 py-3">{typeof trade.avgprice === 'number' ? trade.avgprice.toFixed(2) : '-'}</td>
                <td className="px-4 py-3">{typeof trade.netqty === 'number' ? trade.netqty : '-'}</td>
                <td className="px-4 py-3">{trade.tradetime ? new Date(trade.tradetime).toLocaleString() : '-'}</td>
                <td className="px-4 py-3">{trade.tradeid ?? '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}