"use client"
import { useEffect, useState } from 'react'
import { useMarket } from '@/components/market/market-context'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  selectedBroker: string | null
  onBrokerChange: (broker: string | null) => void
  tradingMode: 'paper' | 'live'
  onTradingModeChange: (mode: 'paper' | 'live') => void
}

export function Header({ selectedBroker, onBrokerChange, tradingMode, onTradingModeChange }: HeaderProps) {
  // Render date/time only on the client to avoid server/client mismatch during hydration
  const [formattedDate, setFormattedDate] = useState<string | null>(null)
  const [formattedTime, setFormattedTime] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    setFormattedDate(
      now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    )
    setFormattedTime(
      now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    )
  }, [])

  const market = useMarket()

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm md:text-base text-gray-700 font-medium">Broker:</span>
        <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded border border-red-200">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 1a9 9 0 100 18 9 9 0 000-18zM10 15a1 1 0 110-2 1 1 0 010 2zm0-4a1 1 0 10-2 0v-2a1 1 0 102 0v2z" />
          </svg>
          <span className="text-red-600 font-semibold text-sm md:text-base">
            Please select broker to trade
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm md:text-base text-gray-700 font-medium">Mode:</span>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <Badge 
              variant={tradingMode === 'paper' ? 'default' : 'outline'}
              className={tradingMode === 'paper' ? 'bg-blue-500' : 'bg-gray-200 text-gray-600'}
            >
              Paper
            </Badge>
            <Switch
              checked={tradingMode === 'live'}
              onCheckedChange={(checked) => onTradingModeChange(checked ? 'live' : 'paper')}
              className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-blue-500"
            />
            <Badge 
              variant={tradingMode === 'live' ? 'default' : 'outline'}
              className={tradingMode === 'live' ? 'bg-red-600' : 'bg-gray-200 text-gray-600'}
            >
              Live
            </Badge>
          </div>
        </div>
      </div>
      <div className="text-xs md:text-sm text-gray-600 font-mono flex items-center gap-4">
        {formattedDate ?? '—/—'}{" "}/ {" "}{formattedTime ?? '—:—:—'}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${market.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`text-xs ${market.connected ? 'text-green-600' : 'text-red-600'}`}>{market.connected ? 'Live' : 'Disconnected'}</span>
          <span className="text-xs text-gray-500">| Subscribed: <span className="text-gray-700 font-semibold">{Object.keys(market.symbols).length}</span></span>
        </div>
      </div>
    </div>
  )
}
