'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, Search, X, TrendingUp, TrendingDown, RefreshCw, Star } from 'lucide-react'
import { useBackendSocket } from '@/hooks/use-backend-socket'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface WatchlistItem {
  id: string
  symbol: string
  name: string
  token: string
  exchange: string
  ltp: number
  prevClose: number
  change: number
  changePercent: number
}

interface SearchResult {
  symbol: string
  name: string
  token: string
  exchange: string
  segment: string
  instrument_type?: string
}

// Default indices to show initially
const DEFAULT_INDICES = [
  { symbol: 'Nifty 50', name: 'NIFTY 50', exchange: 'NSE', token: '99926000' },
  { symbol: 'Nifty Bank', name: 'NIFTY BANK', exchange: 'NSE', token: '99926009' },
  { symbol: 'SENSEX', name: 'SENSEX', exchange: 'BSE', token: '99919000' },
  { symbol: 'Nifty Fin Service', name: 'NIFTY FIN SERVICE', exchange: 'NSE', token: '99926037' },
  { symbol: 'NIFTY MID SELECT', name: 'NIFTY MIDCAP SELECT', exchange: 'NSE', token: '99926074' },
  { symbol: 'Nifty Next 50', name: 'NIFTY NEXT 50', exchange: 'NSE', token: '99926013' },
  { symbol: 'BANKEX', name: 'BANKEX', exchange: 'BSE', token: '99919012' },
]

export function WatchlistTab() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const watchlistRef = useRef<WatchlistItem[]>([])
  const { connected, marketData, subscribe } = useBackendSocket()

  // Keep watchlist ref in sync
  useEffect(() => {
    watchlistRef.current = watchlist
  }, [watchlist])

  // Load watchlist from localStorage on mount or initialize with defaults
  useEffect(() => {
    const savedWatchlist = localStorage.getItem('watchlist')
    if (savedWatchlist) {
      try {
        const parsed = JSON.parse(savedWatchlist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWatchlist(parsed)
          setIsInitialized(true)
          return
        }
      } catch (e) {
        console.error('Error parsing saved watchlist:', e)
      }
    }
    
    // Initialize with default indices
    initializeDefaultWatchlist()
  }, [])

  const initializeDefaultWatchlist = async () => {
    const defaultItems: WatchlistItem[] = DEFAULT_INDICES.map((item, index) => ({
      id: `default-${index}-${Date.now()}`,
      symbol: item.symbol,
      name: item.name,
      token: item.token,
      exchange: item.exchange,
      ltp: 0,
      prevClose: 0,
      change: 0,
      changePercent: 0,
    }))
    
    setWatchlist(defaultItems)
    localStorage.setItem('watchlist', JSON.stringify(defaultItems))
    setIsInitialized(true)
  }

  // Subscribe to watchlist tokens when connected
  useEffect(() => {
    if (connected && watchlist.length > 0 && isInitialized) {
      const tokens = watchlist.map(item => ({
        exchange: item.exchange || 'NSE',
        token: item.token
      }))
      subscribe(tokens, 3) // Mode 3 = Full quote with OHLC
      console.log('📡 Subscribing to watchlist tokens:', tokens)
    }
  }, [connected, isInitialized]) // Don't depend on watchlist.length to avoid re-subscribing loops

  // Re-subscribe when watchlist changes (adding/removing items)
  const watchlistTokensKey = watchlist.map(w => w.token).join(',')
  useEffect(() => {
    if (connected && watchlist.length > 0 && isInitialized) {
      const tokens = watchlist.map(item => ({
        exchange: item.exchange || 'NSE',
        token: item.token
      }))
      subscribe(tokens, 3)
    }
  }, [watchlistTokensKey, connected, isInitialized])

  // Update prices from market data - use a ref to avoid dependency loops
  const marketDataRef = useRef(marketData)
  useEffect(() => {
    marketDataRef.current = marketData
  }, [marketData])

  // Update prices periodically from market data
  useEffect(() => {
    const updatePrices = () => {
      const data = marketDataRef.current
      if (Object.keys(data).length === 0) return
      
      setWatchlist(prev => {
        let hasChanges = false
        const updated = prev.map(item => {
          // Try both string and number token keys
          const tokenData = data[item.token] || data[String(item.token)] || data[Number(item.token)]
          if (tokenData && tokenData.ltp && tokenData.ltp !== item.ltp) {
            hasChanges = true
            const newLtp = tokenData.ltp
            const prevClose = tokenData.close || item.prevClose || newLtp
            const change = newLtp - prevClose
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0
            return {
              ...item,
              ltp: newLtp,
              prevClose,
              change,
              changePercent
            }
          }
          return item
        })
        return hasChanges ? updated : prev
      })
    }

    // Update immediately
    updatePrices()

    // Then update every second
    const interval = setInterval(updatePrices, 1000)
    return () => clearInterval(interval)
  }, [isInitialized])

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && watchlist.length > 0) {
      localStorage.setItem('watchlist', JSON.stringify(watchlist))
    }
  }, [watchlist, isInitialized])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`${API_URL}/symbols/search?q=${encodeURIComponent(searchQuery)}&limit=20`)
        const data = await response.json()
        
        if (data.success && data.data) {
          // Filter out already added symbols
          const existingTokens = new Set(watchlist.map(w => w.token))
          const filtered = data.data.filter((item: SearchResult) => !existingTokens.has(item.token))
          setSearchResults(filtered)
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Error searching symbols:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery, watchlist])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addSymbol = useCallback((item: SearchResult) => {
    const newItem: WatchlistItem = {
      id: `${item.token}-${Date.now()}`,
      symbol: item.symbol,
      name: item.name || item.symbol,
      token: item.token,
      exchange: item.exchange || 'NSE',
      ltp: 0,
      prevClose: 0,
      change: 0,
      changePercent: 0,
    }

    setWatchlist(prev => [...prev, newItem])
    setSearchQuery('')
    setSearchResults([])
    setShowSuggestions(false)

    // Subscribe to the new token
    if (connected) {
      subscribe([{ exchange: newItem.exchange, token: newItem.token }], 3)
    }
  }, [connected, subscribe])

  const removeSymbol = useCallback((id: string) => {
    setWatchlist(prev => {
      const updated = prev.filter(item => item.id !== id)
      localStorage.setItem('watchlist', JSON.stringify(updated))
      return updated
    })
  }, [])

  // Fetch quotes via REST API as fallback
  const fetchQuotesViaAPI = useCallback(async () => {
    const currentWatchlist = watchlistRef.current
    if (currentWatchlist.length === 0) return
    
    try {
      const tokens = currentWatchlist.map(item => ({
        exchange: item.exchange || 'NSE',
        token: item.token
      }))
      
      const response = await fetch(`${API_URL}/quotes/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens })
      })
      
      const json = await response.json()
      if (!json?.success || !Array.isArray(json.data)) return
      
      // Create a map of token to quote data
      const quoteMap: Record<string, any> = {}
      json.data.forEach((quote: any) => {
        if (quote?.token) {
          quoteMap[String(quote.token)] = quote
        }
      })
      
      setWatchlist(prev => {
        let hasChanges = false
        const updated = prev.map(item => {
          const quote = quoteMap[String(item.token)]
          if (quote && quote.ltp && quote.ltp !== item.ltp) {
            hasChanges = true
            const newLtp = quote.ltp
            const prevClose = quote.close || item.prevClose || newLtp
            const change = newLtp - prevClose
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0
            return {
              ...item,
              ltp: newLtp,
              prevClose,
              change,
              changePercent
            }
          }
          return item
        })
        return hasChanges ? updated : prev
      })
    } catch (error) {
      console.error('Error fetching quotes via API:', error)
    }
  }, []) // No dependencies - uses ref

  // Periodically fetch quotes via API as fallback (every 2 seconds)
  useEffect(() => {
    if (!isInitialized) return
    
    // Initial fetch after a small delay to ensure watchlist is set
    const initialTimeout = setTimeout(fetchQuotesViaAPI, 500)
    
    // Then poll every 2 seconds
    const interval = setInterval(fetchQuotesViaAPI, 2000)
    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [isInitialized, fetchQuotesViaAPI])

  const refreshPrices = useCallback(() => {
    const currentWatchlist = watchlistRef.current
    // Try both WebSocket subscription and REST API
    if (connected && currentWatchlist.length > 0) {
      const tokens = currentWatchlist.map(item => ({
        exchange: item.exchange || 'NSE',
        token: item.token
      }))
      subscribe(tokens, 3)
    }
    // Also fetch via API
    fetchQuotesViaAPI()
  }, [connected, subscribe, fetchQuotesViaAPI])

  const clearWatchlist = useCallback(() => {
    if (confirm('Clear watchlist and reset to default indices?')) {
      localStorage.removeItem('watchlist')
      initializeDefaultWatchlist()
    }
  }, [])

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)} / ${sign}${changePercent.toFixed(2)}%`
  }

  const getSegmentBadge = (exchange: string, segment?: string) => {
    if (segment === 'Index' || segment === 'INDICES') {
      return <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">IDX</span>
    }
    return <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{exchange}</span>
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl md:text-2xl font-bold">Watchlist</h2>
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            connected 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshPrices} variant="outline" size="sm" disabled={!connected}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={clearWatchlist} variant="outline" size="sm">
            Reset
          </Button>
        </div>
      </div>

      {/* Search Box */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search symbol (e.g., RELIANCE, TCS, NIFTY)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                    setShowSuggestions(false)
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-y-auto"
              >
                {isSearching ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="py-1">
                    {searchResults.map((result, index) => (
                      <button
                        key={`${result.token}-${index}`}
                        onClick={() => addSymbol(result)}
                        className="w-full px-4 py-2.5 text-left hover:bg-accent flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{result.symbol}</span>
                            {getSegmentBadge(result.exchange, result.segment)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.name}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No symbols found for "{searchQuery}"
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Watchlist */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>My Watchlist</span>
            <span className="text-sm font-normal text-muted-foreground">{watchlist.length} symbols</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No symbols in watchlist</p>
              <p className="text-sm">Search and add symbols above</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b shrink-0">
                <div className="col-span-4">Symbol</div>
                <div className="col-span-2 text-center">Exchange</div>
                <div className="col-span-2 text-right">LTP</div>
                <div className="col-span-3 text-right">Change</div>
                <div className="col-span-1"></div>
              </div>
              
              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto max-h-[60vh]">
                {/* Watchlist Items */}
                {watchlist.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-accent/50 rounded-lg items-center group transition-colors"
                  >
                    {/* Symbol & Name */}
                    <div className="col-span-4 min-w-0">
                      <div className="font-semibold truncate">{item.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                    </div>

                    {/* Exchange */}
                    <div className="col-span-2 text-center">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded font-medium",
                        item.exchange === 'BSE' 
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>
                        {item.exchange}
                      </span>
                    </div>

                    {/* LTP */}
                    <div className="col-span-2 text-right">
                      <span className="font-mono font-semibold">
                        {item.ltp > 0 ? `₹${item.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </span>
                    </div>

                    {/* Change */}
                    <div className="col-span-3 text-right">
                      <div className={cn(
                        "flex items-center justify-end gap-1 text-sm font-medium",
                        item.change > 0 ? 'text-green-600 dark:text-green-400' : 
                        item.change < 0 ? 'text-red-600 dark:text-red-400' : 
                        'text-muted-foreground'
                      )}>
                        {item.change !== 0 && (
                          item.change > 0 ? 
                            <TrendingUp className="w-3 h-3 shrink-0" /> : 
                            <TrendingDown className="w-3 h-3 shrink-0" />
                        )}
                        <span className="font-mono text-xs whitespace-nowrap">
                          {item.ltp > 0 ? formatChange(item.change, item.changePercent) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSymbol(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}