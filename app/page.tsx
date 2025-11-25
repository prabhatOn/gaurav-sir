'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/trading/header'
import { TradeForm } from '@/components/trading/trade-form'
import { PriceCharts } from '@/components/trading/price-charts'
import { ActionButtons } from '@/components/trading/action-buttons'
const DynamicTabsSection = dynamic(() => import('@/components/trading/tabs-section'), { ssr: false })
import { PositionsTable } from '@/components/trading/positions-table'
import { OptionsChainModal } from '@/components/trading/options-chain-modal'
import { BasketOrderTab } from '@/components/trading/basket-order-tab'
import { OrderBookTable } from '@/components/trading/order-book-table'
import { TradeBookTable } from '@/components/trading/trade-book-table'
import { HoldingsTable } from '@/components/trading/holdings-table'
import { FundsTable } from '@/components/trading/funds-table'
import { BrokerTab } from '@/components/trading/broker-tab'
import { WatchlistTab } from '@/components/trading/watchlist-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect } from 'react'

export default function Home() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTab') || 'positions'
    }
    return 'positions'
  })
  const [mainTab, setMainTab] = useState('dashboard')
  const [showColumnsDialog, setShowColumnsDialog] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null)
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper')
  const [showOptionsChain, setShowOptionsChain] = useState(false)
  const [optionsParams, setOptionsParams] = useState<{ symbol?: string; expiryDate?: string } | null>(null)
  const [orderbookTotals, setOrderbookTotals] = useState<{ total: number; pending: number; executed: number; rejected: number; cancelled: number } | null>(null)
  const [holdingsTotals, setHoldingsTotals] = useState<{ totalPnl: number; investedValue: number; marketValue: number } | null>(null)
  const [exportOrderbookFn, setExportOrderbookFn] = useState<(() => void) | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  const handleRefresh = () => {
    // Broadcast a refresh event so individual components can listen if they need to refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('refreshData'))
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', activeTab)
    }
  }, [activeTab])

  useEffect(() => {
    // Only save after component has mounted and loaded from localStorage
    if (isMounted && typeof window !== 'undefined') {
      console.log('Saving trading mode to localStorage:', tradingMode)
      localStorage.setItem('tradingMode', tradingMode)
    }
  }, [tradingMode, isMounted])

  useEffect(() => {
    setHydrated(true)
    // Load trading mode from localStorage after mount
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('tradingMode')
      console.log('Loading trading mode from localStorage:', savedMode)
      if (savedMode === 'live' || savedMode === 'paper') {
        setTradingMode(savedMode)
      }
    }
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const handleShowOptionsChain = (e: Event) => {
      const custom = e as CustomEvent
      const detail = custom?.detail || {}
      setOptionsParams({ symbol: detail?.symbol || 'BANKNIFTY', expiryDate: detail?.expiryDate || '25-Nov-2025' })
      setShowOptionsChain(true)
    }
    window.addEventListener('showOptionsChain', handleShowOptionsChain)
    return () => window.removeEventListener('showOptionsChain', handleShowOptionsChain)
  }, [])

  return (
    <main className="flex flex-col h-screen w-full bg-gray-50">
      <Tabs value={mainTab} onValueChange={setMainTab} className="flex flex-col h-full">
        <div className="bg-white border-b border-gray-200 px-6 py-2">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="broker">Broker</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              {/* Trading controls section - takes ~60vh when content fills */}
              <div className="w-full bg-white border-b border-gray-200">
                <div className="w-full px-3 md:px-6 py-3 md:py-4">
                  <Header selectedBroker={selectedBroker} onBrokerChange={setSelectedBroker} tradingMode={tradingMode} onTradingModeChange={setTradingMode} />
                  <div className="mt-3 md:mt-4">
                    <TradeForm />
                  </div>
                  <div className="mt-4 md:mt-6">
                    <PriceCharts />
                  </div>
                  <div className="mt-4 md:mt-6">
                    <ActionButtons selectedBroker={selectedBroker} tradingMode={tradingMode} />
                  </div>
                </div>
              </div>

              {/* Tabs and table section - fills remaining space */}
              <div className="w-full bg-gray-50">
                <DynamicTabsSection
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onOpenColumnSettings={() => setShowColumnsDialog(true)}
                  orderbookTotals={activeTab === 'orderbook' ? orderbookTotals ?? { total: 0, pending: 0, executed: 0, rejected: 0, cancelled: 0 } : undefined}
                  holdingsTotals={activeTab === 'holdings' ? holdingsTotals ?? { totalPnl: 0, investedValue: 0, marketValue: 0 } : undefined}
                  onExportOrderbook={() => exportOrderbookFn && exportOrderbookFn()}
                  onRefresh={handleRefresh}
                />
                <div className="overflow-x-auto">
                  {hydrated && (
                    <>
                      {activeTab === 'basket' ? (
                        <BasketOrderTab />
                      ) : activeTab === 'orderbook' ? (
                        <OrderBookTable
                          openSettings={showColumnsDialog}
                          onOpenSettings={setShowColumnsDialog}
                          onTotalsChange={(t) => setOrderbookTotals(t)}
                          provideExportFn={(fn) => setExportOrderbookFn(() => fn)}
                        />
                  ) : activeTab === 'tradebook' ? (
                    <TradeBookTable />
                  ) : activeTab === 'holdings' ? (
                    <HoldingsTable onTotalsChange={(t) => setHoldingsTotals(t)} />
                  ) : activeTab === 'funds' ? (
                    <FundsTable />
                  ) : (
                    <PositionsTable openSettings={showColumnsDialog} onOpenSettings={setShowColumnsDialog} tradingMode={tradingMode} />
                  )}
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="broker" className="flex-1 overflow-hidden">
          <BrokerTab />
        </TabsContent>

        <TabsContent value="watchlist" className="flex-1 overflow-hidden">
          <WatchlistTab />
        </TabsContent>
      </Tabs>

      <OptionsChainModal isOpen={showOptionsChain} onClose={() => setShowOptionsChain(false)} symbol={optionsParams?.symbol} expiryDate={optionsParams?.expiryDate} />
    </main>
  )
}
