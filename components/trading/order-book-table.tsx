"use client"

import { useState, useEffect, useCallback } from 'react'
import ColumnSettings from './column-settings'
import { Settings } from 'lucide-react'

interface Order {
  // support multiple naming conventions from backend (snake_case, camelCase, different keys)
  id?: number
  orderid?: string
  symbol_name?: string
  symbol?: string
  symbolname?: string
  name?: string
  transaction_type?: string
  transactiontype?: string
  order_type?: string
  ordertype?: string
  product_type?: string
  producttype?: string
  quantity?: number
  qty?: number
  price?: number
  status?: string
  order_status?: string
  orderstatus?: string
  order_timestamp?: string | number
  updatetime?: string | number
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
}

const allColumns: TableColumn[] = [
  { id: 'symbolname', label: 'Symbol Name' },
  { id: 'type', label: 'Type' },
  { id: 'side', label: 'Side' },
  { id: 'qty', label: 'Qty' },
  { id: 'remqty', label: 'Rem Qty' },
  { id: 'orderprice', label: 'Order Price' },
  { id: 'tradedprice', label: 'Traded Price' },
  { id: 'triggerprice', label: 'Trigger Price' },
  { id: 'status', label: 'Status' },
  { id: 'time', label: 'Time/Date 1' },
  { id: 'orderid', label: 'Order Id 2' },
  { id: 'errormsg', label: 'Error Msg.' },
  { id: 'action', label: 'Action' },
]

export function OrderBookTable({ openSettings, onOpenSettings, onTotalsChange, provideExportFn }: { openSettings?: boolean; onOpenSettings?: (open: boolean) => void; onTotalsChange?: (t: { total: number; pending: number; executed: number; rejected: number; cancelled: number }) => void; provideExportFn?: (fn: () => void) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
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

  // Column settings persisted per-tab
  const DEFAULT_COLS = allColumns.reduce((acc, c) => ({ ...acc, [c.id]: true }), {} as Record<string, boolean>)
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    // First try to load from backend, fallback to localStorage, then defaults
    try {
      const backendSettings = localStorage.getItem('backend-column-settings-orderbook')
      if (backendSettings) {
        return JSON.parse(backendSettings)
      }
      
      const raw = localStorage.getItem('orderbook-columns')
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
        const response = await fetch('http://localhost:5000/api/column-settings/orderbook')
        const data = await response.json()
        if (data.status && data.data) {
          setVisibleCols(data.data)
          localStorage.setItem('backend-column-settings-orderbook', JSON.stringify(data.data))
        }
      } catch (error) {
        console.error('Error loading column settings from backend:', error)
      }
    }
    
    loadBackendSettings()
  }, [])

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

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const url = selectedBrokerId 
        ? `http://localhost:5000/api/orders?brokerId=${selectedBrokerId}`
        : 'http://localhost:5000/api/orders'
      const response = await fetch(url)
      const data = await response.json()

      if (data.status && data.data) {
        // Normalize orders to the shape expected by the table renderer.
        const normalized = (data.data as any[]).map(o => {
          const order: any = {
            // prefer explicit ids
            orderid: o.id ?? o.orderid ?? String(o.id ?? ''),
            symbolname: o.symbol_name ?? o.symbolname ?? o.name ?? o.symbol ?? '-',
            transactiontype: o.transaction_type ?? o.transactiontype ?? o.transactionType ?? '-',
            ordertype: o.order_type ?? o.ordertype ?? o.orderType ?? '-',
            producttype: o.product_type ?? o.producttype ?? o.productType ?? '-',
            quantity: o.quantity ?? o.qty ?? 0,
            price: o.price ?? null,
            status: o.status ?? null,
            orderstatus: o.order_status ?? o.orderstatus ?? o.orderStatus ?? null,
            updatetime: o.order_timestamp ?? o.updatetime ?? o.update_time ?? null,
            brokerId: o.broker_id ?? o.brokerId,
            // keep original payload available for any other fields
            __raw: o,
          }
          return order as Order
        })

        setOrders(normalized)
      } else {
        setError('Failed to fetch orders')
      }
    } catch (err) {
      setError('Error fetching orders')
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchBrokers()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [selectedBrokerId])

  // Keep header and settings available even on loading or error to match UX from the screenshot.

  const totals = {
    total: orders.length,
    pending: orders.filter(o => o.orderstatus?.toLowerCase?.() === 'pending').length,
    executed: orders.filter(o => o.orderstatus?.toLowerCase?.() === 'executed').length,
    rejected: orders.filter(o => o.orderstatus?.toLowerCase?.() === 'rejected').length,
    cancelled: orders.filter(o => o.orderstatus?.toLowerCase?.() === 'cancelled').length,
  }

  // Report totals back to parent (TabsSection via page state)
  useEffect(() => {
    onTotalsChange?.(totals)
  }, [orders])

  const exportCSV = useCallback(() => {
    // Build CSV using visibleCols order
    const columns = allColumns.filter(c => visibleCols[c.id])
    const header = columns.map(c => `"${c.label}"`).join(',')
    const rows = orders.map(o => {
      return columns
        .map(col => {
          const v = (o as any)[col.id]
          if (v === undefined || v === null) return '""'
          const str = typeof v === 'string' ? v : String(v)
          return `"${str.replace(/"/g, '""')}"`
        })
        .join(',')
    })
    const content = [header, ...rows].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orderbook_${new Date().toISOString()}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [orders, visibleCols])

  useEffect(() => {
    if (provideExportFn) provideExportFn(exportCSV)
  }, [provideExportFn, exportCSV])

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
            onClick={() => fetchOrders()}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* totals moved to TabsSection. Expose export function to parent (if requested). */}

      <table className="w-full text-xs min-w-max whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            {allColumns.filter(c => visibleCols[c.id]).map(col => (
              <th key={col.id} className="px-4 py-3 text-left font-medium text-gray-700">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={allColumns.filter(c => visibleCols[c.id]).length} className="px-3 py-12 text-center text-red-500 text-xs">{error}</td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={allColumns.filter(c => visibleCols[c.id]).length} className="px-3 py-12 text-center text-gray-500 text-xs">
                No Orders To Show
              </td>
            </tr>
          ) : (
            orders.map((order, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                {allColumns.filter(c => visibleCols[c.id]).map(col => {
                  const val: any = (order as any)[col.id]
                  switch (col.id) {
                    case 'symbolname':
                      return <td key={col.id} className="px-4 py-3 font-medium">{order.symbolname}</td>
                    case 'type':
                      return <td key={col.id} className="px-4 py-3">{order.transactiontype}{order.ordertype ? ` ${order.ordertype}` : ''}</td>
                    case 'side':
                      return <td key={col.id} className="px-4 py-3">{order.transactiontype}</td>
                    case 'qty':
                      return <td key={col.id} className="px-4 py-3">{order.quantity}</td>
                    case 'remqty':
                    case 'tradedprice':
                    case 'triggerprice':
                    case 'errormsg':
                    case 'action':
                      return <td key={col.id} className="px-4 py-3">{val ?? '-'}</td>
                    case 'orderprice':
                      return <td key={col.id} className="px-4 py-3">{order.price}</td>
                    case 'status':
                      return <td key={col.id} className="px-4 py-3">{order.orderstatus || order.status}</td>
                    case 'time':
                      return <td key={col.id} className="px-4 py-3">{order.updatetime ? new Date(order.updatetime).toLocaleString() : '-'}</td>
                    case 'orderid':
                      return <td key={col.id} className="px-4 py-3">{order.orderid}</td>
                    default:
                      return <td key={col.id} className="px-4 py-3">{val ?? '-'}</td>
                  }
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ColumnSettings
        open={showColumnSettingsState}
        onOpenChange={setShowColumnSettings}
        columns={allColumns.map(c => ({ id: c.id, label: c.label }))}
        selected={visibleCols}
        onSave={(sel) => { 
          setVisibleCols(sel); 
          localStorage.setItem('orderbook-columns', JSON.stringify(sel));
          localStorage.setItem('backend-column-settings-orderbook', JSON.stringify(sel));
          // Save to backend
          fetch('http://localhost:5000/api/column-settings/orderbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sel)
          }).catch(error => console.error('Error saving column settings to backend:', error));
        }}
        onReset={() => { 
          localStorage.removeItem('orderbook-columns'); 
          localStorage.removeItem('backend-column-settings-orderbook');
          setVisibleCols(DEFAULT_COLS);
          // Reset on backend
          fetch('http://localhost:5000/api/column-settings/orderbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEFAULT_COLS)
          }).catch(error => console.error('Error resetting column settings on backend:', error));
        }}
      />
    </div>
  )
}