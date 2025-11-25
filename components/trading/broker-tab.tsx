'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, RefreshCw, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react'
import { toast } from 'sonner'

interface Broker {
  id: number
  name: string
  broker_type: string
  api_key: string
  api_secret: string
  is_active: boolean
  status?: string
  health_status?: string
  last_health_check?: string
  created_at?: string
  updated_at?: string
}

interface BrokerHealth {
  id: number
  name: string
  type: string
  status: string
  healthStatus: string
  lastHealthCheck: string
  isActive: boolean
  responseTime?: number
  errorMessage?: string
}

export function BrokerTab() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokerHealth, setBrokerHealth] = useState<BrokerHealth[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState<number | null>(null)
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    brokerType: 'angelone',
    apiKey: '',
    apiSecret: '',
    isActive: false
  })

  useEffect(() => {
    loadBrokers()
    loadBrokerHealth()
  }, [])

  // Auto-refresh broker health
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadBrokerHealth()
      }, 30000) // Refresh every 30 seconds
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [autoRefresh])

  const loadBrokers = async () => {
    try {
      const response = await fetch('/api/brokers')
      const data = await response.json()
      if (data.status) {
        setBrokers(data.data)
      }
    } catch (error) {
      console.error('Failed to load brokers:', error)
      toast.error('Failed to load brokers')
    }
  }

  const loadBrokerHealth = async () => {
    try {
      const response = await fetch('/api/brokers/health')
      const data = await response.json()
      if (data.status) {
        setBrokerHealth(data.data)
      }
    } catch (error) {
      console.error('Failed to load broker health:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = editingBroker ? `/api/brokers/${editingBroker.id}` : '/api/brokers'
      const method = editingBroker ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          brokerType: formData.brokerType,
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          isActive: formData.isActive
        })
      })

      const data = await response.json()

      if (data.status) {
        toast.success(editingBroker ? 'Broker updated successfully' : 'Broker added successfully')
        resetForm()
        setIsDialogOpen(false)
        loadBrokers()
        loadBrokerHealth()
      } else {
        toast.error(data.error || 'Failed to save broker')
      }
    } catch (error) {
      console.error('Failed to save broker:', error)
      toast.error('Failed to save broker')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (broker: Broker) => {
    setEditingBroker(broker)
    setFormData({
      name: broker.name,
      brokerType: broker.broker_type,
      apiKey: broker.api_key,
      apiSecret: broker.api_secret,
      isActive: broker.is_active
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (brokerId: number) => {
    if (!confirm('Are you sure you want to delete this broker?')) return

    try {
      const response = await fetch(`/api/brokers/${brokerId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.status) {
        toast.success('Broker deleted successfully')
        loadBrokers()
        loadBrokerHealth()
      } else {
        toast.error(data.error || 'Failed to delete broker')
      }
    } catch (error) {
      console.error('Failed to delete broker:', error)
      toast.error('Failed to delete broker')
    }
  }

  const handleToggleActive = async (brokerId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/brokers/${brokerId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })

      const data = await response.json()

      if (data.status) {
        toast.success(`Broker ${isActive ? 'activated' : 'deactivated'} successfully`)
        loadBrokers()
        loadBrokerHealth()
      } else {
        toast.error(data.error || 'Failed to toggle broker status')
      }
    } catch (error) {
      console.error('Failed to toggle broker status:', error)
      toast.error('Failed to toggle broker status')
    }
  }

  const handleOpenSettings = (broker: Broker) => {
    setSelectedBroker(broker)
    setIsSettingsOpen(true)
  }

  const handleSaveSettings = async (settings: any) => {
    if (!selectedBroker) return

    try {
      // Save broker-specific settings (this would be implemented in the backend)
      const response = await fetch(`/api/brokers/${selectedBroker.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()
      if (data.status) {
        toast.success('Broker settings saved successfully')
        setIsSettingsOpen(false)
        setSelectedBroker(null)
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save broker settings:', error)
      toast.error('Failed to save broker settings')
    }
  }

  const handleSyncBroker = async (brokerId: number) => {
    setIsSyncing(brokerId)
    try {
      const response = await fetch(`/api/brokers/${brokerId}/sync`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.status) {
        toast.success('Broker data synced successfully')
        loadBrokerHealth()
      } else {
        toast.error(data.error || 'Failed to sync broker data')
      }
    } catch (error) {
      console.error('Failed to sync broker data:', error)
      toast.error('Failed to sync broker data')
    } finally {
      setIsSyncing(null)
    }
  }

  const getHealthDetails = (broker: Broker) => {
    const health = brokerHealth.find(h => h.id === broker.id)
    if (!health) return null

    return {
      status: health.healthStatus,
      lastCheck: health.lastHealthCheck,
      responseTime: health.responseTime || null,
      errorMessage: health.errorMessage || null
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      brokerType: 'angelone',
      apiKey: '',
      apiSecret: '',
      isActive: false
    })
    setEditingBroker(null)
  }

  const getStatusBadge = (broker: Broker) => {
    const health = brokerHealth.find(h => h.id === broker.id)

    if (!broker.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }

    if (!health) {
      return <Badge variant="outline">Unknown</Badge>
    }

    switch (health.healthStatus) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>
      case 'warning':
        return <Badge variant="default" className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Warning</Badge>
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getBrokerTypeDisplay = (type: string) => {
    switch (type) {
      case 'angelone':
        return 'Angel One'
      case 'motilal':
        return 'Motilal Oswal'
      case 'tradesmart':
        return 'TradeSmart'
      case 'jainam':
        return 'Jainam'
      case 'jmfinancial':
        return 'JM Financial'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Broker Management</h2>
        <div className="flex space-x-2 items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="autoRefresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="autoRefresh" className="text-sm">Auto-refresh (30s)</Label>
          </div>
          <Button variant="outline" onClick={loadBrokerHealth}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Broker
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingBroker ? 'Edit Broker' : 'Add New Broker'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Broker Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="brokerType">Broker Type</Label>
                  <select
                    id="brokerType"
                    value={formData.brokerType}
                    onChange={(e) => setFormData({ ...formData, brokerType: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="angelone">Angel One</option>
                    <option value="motilal">Motilal Oswal</option>
                    <option value="tradesmart">TradeSmart</option>
                    <option value="jainam">Jainam</option>
                    <option value="jmfinancial">JM Financial</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : (editingBroker ? 'Update' : 'Add')} Broker
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Broker Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Broker Settings - {selectedBroker?.name}</DialogTitle>
          </DialogHeader>
          {selectedBroker && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Risk Management</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxOrderValue" className="text-sm">Max Order Value (₹)</Label>
                      <Input
                        id="maxOrderValue"
                        type="number"
                        defaultValue="100000"
                        className="w-24 h-8"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxDailyLoss" className="text-sm">Max Daily Loss (%)</Label>
                      <Input
                        id="maxDailyLoss"
                        type="number"
                        defaultValue="5"
                        className="w-20 h-8"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxPositions" className="text-sm">Max Open Positions</Label>
                      <Input
                        id="maxPositions"
                        type="number"
                        defaultValue="10"
                        className="w-20 h-8"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Order Settings</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="defaultProduct" className="text-sm">Default Product</Label>
                      <select className="w-24 h-8 px-2 border rounded text-sm">
                        <option>MIS</option>
                        <option>CNC</option>
                        <option>NRML</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="orderTimeout" className="text-sm">Order Timeout (s)</Label>
                      <Input
                        id="orderTimeout"
                        type="number"
                        defaultValue="30"
                        className="w-20 h-8"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="autoCancel" defaultChecked />
                      <Label htmlFor="autoCancel" className="text-sm">Auto-cancel pending orders</Label>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Notification Settings</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="orderAlerts" defaultChecked />
                      <Label htmlFor="orderAlerts" className="text-sm">Order execution alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="positionAlerts" defaultChecked />
                      <Label htmlFor="positionAlerts" className="text-sm">Position alerts</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="marginAlerts" defaultChecked />
                      <Label htmlFor="marginAlerts" className="text-sm">Margin threshold alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="errorAlerts" defaultChecked />
                      <Label htmlFor="errorAlerts" className="text-sm">Error alerts</Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleSaveSettings({})}>
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Configured Brokers</CardTitle>
        </CardHeader>
        <CardContent>
          {brokers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No brokers configured yet. Add your first broker to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health Details</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokers.map((broker) => {
                  const healthDetails = getHealthDetails(broker)
                  return (
                    <TableRow key={broker.id}>
                      <TableCell className="font-medium">{broker.name}</TableCell>
                      <TableCell>{getBrokerTypeDisplay(broker.broker_type)}</TableCell>
                      <TableCell>{getStatusBadge(broker)}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {healthDetails ? (
                            <div>
                              <div>Last check: {new Date(healthDetails.lastCheck).toLocaleTimeString()}</div>
                              {healthDetails.responseTime && (
                                <div className="text-gray-500">{healthDetails.responseTime}ms</div>
                              )}
                              {healthDetails.errorMessage && (
                                <div className="text-red-500 truncate max-w-32" title={healthDetails.errorMessage}>
                                  Error: {healthDetails.errorMessage.substring(0, 20)}...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No data</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={broker.is_active}
                          onCheckedChange={(checked) => handleToggleActive(broker.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {broker.api_key.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncBroker(broker.id)}
                            disabled={isSyncing === broker.id}
                            title="Sync broker data"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing === broker.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenSettings(broker)}
                            title="Broker settings"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(broker)}
                            title="Edit broker"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(broker.id)}
                            title="Delete broker"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}