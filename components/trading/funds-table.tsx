'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle } from 'lucide-react'

interface FundsProps {
  disableFetch?: boolean
}

interface BrokerFunds {
  broker_id: number
  broker_name: string
  broker_type: string
  available_margin: number
  used_margin: number
  total_balance: number
  realized_pnl: number
  unrealized_pnl: number
  margin_utilization: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

export function FundsTable({ disableFetch }: FundsProps) {
  const [funds, setFunds] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [realizedPnL, setRealizedPnL] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [brokers, setBrokers] = useState<any[]>([])
  const [brokerFunds, setBrokerFunds] = useState<BrokerFunds[]>([])
  const [selectedBroker, setSelectedBroker] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'consolidated' | 'individual'>('consolidated')
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    if (disableFetch) {
      setFunds({ available_margin: 100000, used_margin: 0, total_balance: 100000 })
      setAccounts([
        { name: 'NSE - Derivatives' },
        { name: 'NSE - Equity' }
      ])
      setRealizedPnL(0)
      setLoading(false)
      return
    }

    fetchData()
    fetchBrokers()
  }, [disableFetch])

  useEffect(() => {
    if (!disableFetch) {
      fetchData()
    }
  }, [selectedBroker, viewMode])

  const fetchBrokers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/brokers')
      const data = await response.json()
      if (data.status && data.data) {
        setBrokers(data.data.filter((b: any) => b.is_active))
      }
    } catch (error) {
      console.error('Error fetching brokers:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      if (viewMode === 'individual' && selectedBroker && selectedBroker !== 'all') {
        // Fetch individual broker funds
        const [fundsResponse, accountsResponse, pnlResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/funds?brokerId=${selectedBroker}`),
          fetch('http://localhost:5000/api/accounts'),
          fetch(`http://localhost:5000/api/realized-pnl?brokerId=${selectedBroker}`)
        ])

        const fundsData = await fundsResponse.json()
        const accountsData = await accountsResponse.json()
        const pnlData = await pnlResponse.json()

        if (fundsData.status && fundsData.data) {
          setFunds(fundsData.data)
        }
        if (accountsData.status && accountsData.data) {
          setAccounts(accountsData.data)
        }
        if (pnlData.status && pnlData.data) {
          setRealizedPnL(pnlData.data.realized_pnl)
        }
      } else {
        // Fetch consolidated funds across all brokers
        const [fundsResponse, accountsResponse, pnlResponse, brokerFundsResponse] = await Promise.all([
          fetch('http://localhost:5000/api/funds'),
          fetch('http://localhost:5000/api/accounts'),
          fetch('http://localhost:5000/api/realized-pnl'),
          fetch('http://localhost:5000/api/brokers/funds/all')
        ])

        const fundsData = await fundsResponse.json()
        const accountsData = await accountsResponse.json()
        const pnlData = await pnlResponse.json()
        const brokerFundsData = await brokerFundsResponse.json()

        if (fundsData.status && fundsData.data) {
          setFunds(fundsData.data)
        }
        if (accountsData.status && accountsData.data) {
          setAccounts(accountsData.data)
        }
        if (pnlData.status && pnlData.data) {
          setRealizedPnL(pnlData.data.realized_pnl)
        }
        if (brokerFundsData.status && brokerFundsData.data) {
          setBrokerFunds(brokerFundsData.data)
          generateAlerts(brokerFundsData.data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAlerts = (brokerFundsData: BrokerFunds[]) => {
    const newAlerts: any[] = []

    brokerFundsData.forEach(broker => {
      const utilization = broker.margin_utilization || 0

      if (utilization > 90) {
        newAlerts.push({
          type: 'critical',
          broker: broker.broker_name,
          message: `Critical: Margin utilization at ${utilization.toFixed(1)}%`,
          action: 'Reduce positions or add funds'
        })
      } else if (utilization > 75) {
        newAlerts.push({
          type: 'high',
          broker: broker.broker_name,
          message: `High margin utilization: ${utilization.toFixed(1)}%`,
          action: 'Monitor closely'
        })
      }

      if (broker.unrealized_pnl < -5000) {
        newAlerts.push({
          type: 'warning',
          broker: broker.broker_name,
          message: `Significant unrealized loss: ₹${broker.unrealized_pnl.toLocaleString()}`,
          action: 'Consider position management'
        })
      }
    })

    setAlerts(newAlerts)
  }

  const rows = [
    {
      label: 'Total Balance',
      value: funds ? `₹${funds.total_balance?.toLocaleString() || '0'}` : '-',
      change: viewMode === 'individual' ? 2500 : undefined
    },
    {
      label: 'Used Margin',
      value: funds ? `₹${funds.used_margin?.toLocaleString() || '0'}` : '-',
      change: viewMode === 'individual' ? -1200 : undefined
    },
    {
      label: 'Realized P&L',
      value: realizedPnL !== null ? `₹${realizedPnL.toLocaleString()}` : '-',
      change: viewMode === 'individual' ? realizedPnL || 0 : undefined
    },
    {
      label: 'Available',
      value: funds ? `₹${funds.available_margin?.toLocaleString() || '0'}` : '-',
      change: viewMode === 'individual' ? 3700 : undefined
    },
  ]

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 space-y-6">
      {/* Header with Broker Selection and View Mode */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold text-gray-900">Funds & Margin Dashboard</h2>
          <Badge variant="outline" className="text-xs">
            {viewMode === 'consolidated' ? 'All Brokers' : selectedBroker || 'All Brokers'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="broker-select" className="text-sm font-medium">Broker:</Label>
            <Select value={selectedBroker} onValueChange={setSelectedBroker}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select broker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brokers</SelectItem>
                {brokers.map((broker) => (
                  <SelectItem key={broker.broker_id} value={broker.broker_id}>
                    {broker.broker_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="view-mode" className="text-sm font-medium">View:</Label>
            <Select value={viewMode} onValueChange={(value: 'consolidated' | 'individual') => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidated">Consolidated</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Risk Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-red-700">Risk Management Alerts</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div key={index} className={`flex items-start gap-3 p-3 rounded-md ${
                alert.type === 'critical' ? 'bg-red-50 border border-red-200' :
                alert.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <div className={`mt-0.5 h-2 w-2 rounded-full ${
                  alert.type === 'critical' ? 'bg-red-500' :
                  alert.type === 'warning' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{alert.broker}</span>
                    <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                      {alert.type.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                  {alert.action && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">Action: {alert.action}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Funds Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map((account, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl text-gray-700">{account.name}</h3>
              {viewMode === 'individual' && selectedBroker && (
                <Badge variant="outline" className="text-xs">
                  {brokers.find(b => b.broker_id === selectedBroker)?.broker_name}
                </Badge>
              )}
            </div>

            {/* Margin Utilization Chart */}
            {funds && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Margin Utilization</span>
                  <span className="text-sm text-gray-600">
                    {((funds.used_margin / funds.total_balance) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      (funds.used_margin / funds.total_balance) > 0.8 ? 'bg-red-500' :
                      (funds.used_margin / funds.total_balance) > 0.6 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((funds.used_margin / funds.total_balance) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Used: ₹{funds.used_margin?.toLocaleString() || '0'}</span>
                  <span>Total: ₹{funds.total_balance?.toLocaleString() || '0'}</span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-700">Type</th>
                    <th className="text-left px-4 py-3 text-gray-700">Balance</th>
                    {viewMode === 'individual' && (
                      <th className="text-left px-4 py-3 text-gray-700">Change</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-4 text-gray-600 font-medium">{row.label}</td>
                      <td className="px-4 py-4 text-gray-600">{row.value}</td>
                      {viewMode === 'individual' && (
                        <td className="px-4 py-4 text-gray-600">
                          {row.change !== undefined ? (
                            <span className={row.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {row.change >= 0 ? '+' : ''}₹{row.change.toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Cross-Broker Summary (only show in consolidated view) */}
      {viewMode === 'consolidated' && brokers.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Cross-Broker Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ₹{brokers.reduce((sum, b) => sum + (b.total_balance || 0), 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Balance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ₹{brokers.reduce((sum, b) => sum + (b.available_margin || 0), 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Available Margin</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                brokers.reduce((sum, b) => sum + (b.unrealized_pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ₹{brokers.reduce((sum, b) => sum + (b.unrealized_pnl || 0), 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Unrealized P&L</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
