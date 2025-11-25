'use client'

import { useState, useEffect } from 'react'
import ColumnSettings from './column-settings'
import { Settings } from 'lucide-react'

interface Position {
  symboltoken: string
  symbolname: string
  netqty: number
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

interface TableColumn {
  id: string
  label: string
  sortable?: boolean
}

const allColumns: TableColumn[] = [
  { id: 'symbol', label: 'Symbol Name', sortable: true },
  { id: 's', label: 'Side', sortable: true },
  { id: 'net', label: 'Net Qty', sortable: false },
  { id: 'avgprice', label: 'Avg Price', sortable: false },
  { id: 'ltp', label: 'LTP', sortable: false },
  { id: 'sl', label: 'SL', sortable: false },
  { id: 'setsl', label: 'Set SL', sortable: false },
  { id: 'target', label: 'Target', sortable: false },
  { id: 'settarget', label: 'Set Target', sortable: false },
  { id: 'rpal', label: 'R. P&L', sortable: false },
  { id: 'urpal', label: 'UR. P&L', sortable: false },
  { id: 'pal', label: 'P&L', sortable: false },
  { id: 'action', label: 'Action', sortable: false },
  { id: 'buy', label: 'Buy Qty', sortable: false },
  { id: 'buypri', label: 'Buy Price', sortable: false },
  { id: 'sellpri', label: 'Sell Price', sortable: false },
  { id: 'sellqty', label: 'Sell Qty', sortable: false },
  { id: 'product', label: 'Product', sortable: false },
]

export function PositionsTable({ openSettings, onOpenSettings, disableFetch, tradingMode = 'paper' }: { openSettings?: boolean, onOpenSettings?: (open: boolean) => void, disableFetch?: boolean, tradingMode?: 'paper' | 'live' }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [selectedBrokerId, setSelectedBrokerId] = useState<number | null>(null)
  const [loadingBrokers, setLoadingBrokers] = useState(false)
  const [showColumnSettingsState, setShowColumnSettingsState] = useState<boolean>(() => !!openSettings)
  useEffect(() => {
    if (typeof openSettings !== 'undefined') setShowColumnSettingsState(openSettings)
  }, [openSettings])

  const setShowColumnSettings = (open: boolean) => {
    setShowColumnSettingsState(open)
    onOpenSettings?.(open)
  }

  const DEFAULT_COLS = allColumns.reduce((acc, c) => ({ ...acc, [c.id]: true }), {} as Record<string, boolean>)
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    // First try to load from backend, fallback to localStorage, then defaults
    try {
      const backendSettings = localStorage.getItem('backend-column-settings-positions')
      if (backendSettings) {
        return JSON.parse(backendSettings)
      }
      
      const raw = localStorage.getItem('positions-columns')
      if (raw) return JSON.parse(raw)
    } catch (e) {
      // ignore
    }
    return DEFAULT_COLS
  })

  // Load column settings from backend on mount
  useEffect(() => {
    const loadBackendSettings = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/column-settings/positions')
        const data = await response.json()
        if (data.status && data.data) {
          setVisibleCols(data.data)
          localStorage.setItem('backend-column-settings-positions', JSON.stringify(data.data))
        }
      } catch (error) {
        console.error('Error loading column settings from backend:', error)
      }
    }
    
    if (!disableFetch) {
      loadBackendSettings()
    }
  }, [disableFetch])

  useEffect(() => {
    if (disableFetch) {
      // Use local empty dataset and don't attempt the remote fetch
      setPositions([])
      setLoading(false)
      setError(null)
      return
    }
    fetchPositions()
    fetchBrokers()
  }, [disableFetch])

  useEffect(() => {
    if (!disableFetch) {
      fetchPositions()
    }
  }, [selectedBrokerId, tradingMode])

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

  const fetchPositions = async () => {
    try {
      setLoading(true)
      let url = `http://localhost:5000/api/positions?tradingMode=${tradingMode}`
      if (selectedBrokerId) {
        url += `&brokerId=${selectedBrokerId}`
      }
      console.log('Fetching positions with URL:', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('Positions API response:', data)
      
      if (data.status && data.data) {
        console.log(`Found ${data.data.length} positions`)
        const mappedPositions = data.data.map(pos => ({
          symboltoken: pos.symbol_id?.toString() || '',
          symbolname: pos.symbol_name || pos.symbol || 'Unknown',
          netqty: parseFloat(pos.quantity) || 0,
          avgnetprice: parseFloat(pos.average_price) || 0,
          ltp: parseFloat(pos.average_price) || 0, // Use avg price as LTP until real market data is available
          pnl: parseFloat(pos.pnl) || 0,
          unrealised: parseFloat(pos.unrealised) || 0,
          realised: parseFloat(pos.realised) || 0,
          brokerId: pos.broker_id ?? pos.brokerId
        }))
        console.log('Mapped positions:', mappedPositions)
        setPositions(mappedPositions)
      } else {
        setPositions([])
        setError('Error fetching positions')
      }
    } catch (err) {
      // Avoid exposing remote data errors to the table — show a friendly error and clear rows.
      setPositions([])
      setError('Error fetching positions')
      console.error('Error fetching positions:', err)
    } finally {
      setLoading(false)
    }
  }

  // We want to keep table header & settings available even when we show loading or error state.
  // Avoid returning early so the settings button can always be shown.

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
            onClick={() => fetchPositions()}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Settings button removed here (use the MTM bar gear instead). */}
      {/* If loading, show placeholder in the table area */}
      {loading && (
        <div className="px-3 py-8 text-center text-gray-500">Loading positions...</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left">
              <input type="checkbox" className="w-3 h-3 rounded border-gray-300 cursor-pointer" />
            </th>
            {allColumns.filter(c => visibleCols[c.id]).map(col => (
              <th
                key={col.id}
                className={`px-4 py-3 text-left font-medium text-gray-700 ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && <span className="text-xs">↓</span>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={Object.keys(visibleCols).filter(k => visibleCols[k]).length + 1} className="px-3 py-12 text-center text-red-500 text-xs">
                {error}
              </td>
            </tr>
          ) : positions.length === 0 ? (
            <tr>
              <td colSpan={Object.keys(visibleCols).filter(k => visibleCols[k]).length + 1} className="px-3 py-12 text-center text-gray-500 text-xs">
                No Positions To Show
              </td>
            </tr>
          ) : (
            positions.map((position, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input type="checkbox" className="w-3 h-3 rounded border-gray-300 cursor-pointer" />
                </td>
                {allColumns.filter(c => visibleCols[c.id]).map(col => {
                  switch (col.id) {
                    case 'symbol':
                      return <td key={col.id} className="px-4 py-3 font-medium">{position.symbolname}</td>
                    case 's':
                      return <td key={col.id} className="px-4 py-3">{position.netqty > 0 ? 'B' : 'S'}</td>
                    case 'net':
                      return <td key={col.id} className="px-4 py-3">{Math.abs(position.netqty)}</td>
                    case 'avgprice':
                      return <td key={col.id} className="px-4 py-3">{typeof position.avgnetprice === 'number' ? position.avgnetprice.toFixed(2) : '-'}</td>
                    case 'ltp':
                      return <td key={col.id} className="px-4 py-3">{typeof position.ltp === 'number' ? position.ltp.toFixed(2) : '-'}</td>
                    case 'sl':
                    case 'setsl':
                    case 'target':
                    case 'settarget':
                      return <td key={col.id} className="px-4 py-3">-</td>
                    case 'rpal':
                      return <td key={col.id} className="px-3 py-2">-</td>
                    case 'urpal':
                      return <td key={col.id} className="px-4 py-3">{typeof position.unrealised === 'number' ? position.unrealised.toFixed(2) : '-'}</td>
                    case 'pal':
                      return <td key={col.id} className={`px-4 py-3 ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{typeof position.pnl === 'number' ? position.pnl.toFixed(2) : '-'}</td>
                    case 'action':
                      return <td key={col.id} className="px-4 py-3">-</td>
                    case 'buy':
                    case 'buypri':
                    case 'sellpri':
                    case 'sellqty':
                    case 'product':
                      return <td key={col.id} className="px-3 py-2">-</td>
                    default:
                      return <td key={col.id} className="px-3 py-2">-</td>
                  }
                })}
                {/* row cells are produced dynamically from visible columns */}
              </tr>
            ))
          )}
        </tbody>
        </table>
      </div>
      <ColumnSettings
        open={showColumnSettingsState}
        onOpenChange={setShowColumnSettings}
        columns={allColumns.map(c => ({ id: c.id, label: c.label }))}
        selected={visibleCols}
        onSave={(sel) => { 
          setVisibleCols(sel); 
          localStorage.setItem('positions-columns', JSON.stringify(sel));
          localStorage.setItem('backend-column-settings-positions', JSON.stringify(sel));
          // Save to backend
          fetch('http://localhost:5000/api/column-settings/positions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sel)
          }).catch(error => console.error('Error saving column settings to backend:', error));
        }}
        onReset={() => { 
          localStorage.removeItem('positions-columns'); 
          localStorage.removeItem('backend-column-settings-positions');
          setVisibleCols(DEFAULT_COLS);
          // Reset on backend
          fetch('http://localhost:5000/api/column-settings/positions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEFAULT_COLS)
          }).catch(error => console.error('Error resetting column settings on backend:', error));
        }}
      />
    </div>
  )
}
