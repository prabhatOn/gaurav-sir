'use client'

import { Settings } from 'lucide-react'

interface TabsSectionProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onOpenColumnSettings?: () => void
  orderbookTotals?: { total: number; pending: number; executed: number; rejected: number; cancelled: number }
  holdingsTotals?: { totalPnl: number; investedValue: number; marketValue: number }
  onExportOrderbook?: () => void
  onRefresh?: () => void
}

const tabs = [
  { id: 'positions', label: 'Positions' },
  { id: 'orderbook', label: 'Order book' },
  { id: 'tradebook', label: 'Trade Book' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'funds', label: 'Funds' },
  { id: 'basket', label: 'Basket order' },
  { id: 'refresh', label: 'Refresh Data' },
]

export default function TabsSection({ activeTab, onTabChange, onOpenColumnSettings, orderbookTotals, holdingsTotals, onExportOrderbook, onRefresh }: TabsSectionProps) {
  const handleOpenColumns = () => onOpenColumnSettings && onOpenColumnSettings()
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              // 'refresh' is a button-like item — call handler but do not change the active tab
              if (tab.id === 'refresh') {
                onRefresh?.()
                return
              }
              onTabChange(tab.id)
            }}
            className={`px-3 py-2 text-xs md:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-red-600 border-red-600'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Header bar (MTM and Totals) — hidden when on tradebook */}
      {activeTab !== 'tradebook' && activeTab !== 'funds' && activeTab !== 'basket' ? (
        <div className="px-3 py-2 flex justify-between items-center text-xs bg-gray-50 border-b border-gray-200">
          <div>
            {activeTab === 'positions' && (
              <p className="text-gray-700">Net Buy Qty: <span className="font-semibold">0</span> / Net Sell Qty: <span className="font-semibold">0</span></p>
            )}
            {activeTab === 'orderbook' && orderbookTotals && (
              <p className="text-gray-700 mt-1 text-sm">Total Orders : <span className="font-semibold">{orderbookTotals.total}</span> &nbsp; Pending : <span className="font-semibold">{orderbookTotals.pending}</span> &nbsp; Executed : <span className="font-semibold">{orderbookTotals.executed}</span> &nbsp; Rejected : <span className="font-semibold">{orderbookTotals.rejected}</span> &nbsp; Cancelled : <span className="font-semibold">{orderbookTotals.cancelled}</span></p>
            )}
            {activeTab === 'holdings' && (
              <p className="text-gray-700">Currently, we support only NSE F&O stock holdings:</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'orderbook' && (
              <button onClick={() => onExportOrderbook && onExportOrderbook()} className="px-4 py-1 text-sm border border-red-600 text-red-600 rounded font-semibold">EXPORT CSV</button>
            )}

            <button onClick={() => onRefresh && onRefresh()} className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100">Refresh Data</button>

            {activeTab === 'holdings' || activeTab === 'funds' || activeTab === 'basket' ? (
              holdingsTotals && (
                <div className="text-sm text-gray-700 mr-4">
                  <span>Total P&L: </span>
                  <span className={`font-semibold ${holdingsTotals.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{holdingsTotals.totalPnl.toFixed(2)}</span>
                  <span className="ml-6">Total Invested Value: <span className="font-semibold">{holdingsTotals.investedValue.toFixed(2)}</span></span>
                  <span className="ml-6">Total Market Value: <span className="font-semibold">{holdingsTotals.marketValue.toFixed(2)}</span></span>
                </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">MTM:</span>
                  <span className="text-green-600 font-semibold">0.00</span>
                  <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
                  </svg>
                </div>

                <button onClick={handleOpenColumns} className="p-1 hover:bg-gray-200 rounded transition-colors mr-3">
                  <Settings className="w-4 h-4 text-gray-600" />
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
