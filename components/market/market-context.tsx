"use client"

import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

type MarketSymbolData = {
  ltp?: number
  token?: number
  exchange?: string
  timestamp?: string
  lot_size?: number
  low?: number
  high?: number
  open?: number
  close?: number
  atp?: number
  volume?: number
  oi?: number
  percentChange?: number
  netChange?: number
  depth?: any
}

type TokenInput = string | number | { token: string | number; symbol?: string; exchange?: string }

type MarketState = {
  symbols: Record<string, MarketSymbolData>
  connected: boolean
  // Components can request live updates for specific contracts/symbols
  subscribeTokens?: (tokens: TokenInput[]) => void
}

const MarketContext = createContext<MarketState | null>(null)

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

// Default tokens will be fetched dynamically from API when needed
// These are just placeholder keys - actual tokens come from database when symbol is selected
const DEFAULT_TOKENS: TokenInput[] = []

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Record<string, MarketSymbolData>>({})
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const pendingTokensRef = useRef<Set<string>>(new Set())
  const tokenMetaRef = useRef<Map<string, { exchange: string; symbol?: string }>>(new Map())
  const defaultsRegisteredRef = useRef(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  // Use refs to avoid dependency issues
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  }, [store])

  const emitPendingSubscriptions = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected || pendingTokensRef.current.size === 0) return
    const payload = Array.from(pendingTokensRef.current).map(key => {
      const [exchange, token] = key.split(':')
      const meta = tokenMetaRef.current.get(key)
      const symbol = meta?.symbol
      return {
        exchange,
        token,
        symbol,
        symbolName: symbol,
      }
    })
    try {
      socketRef.current.emit('subscribePositions', { brokerId: 'market', tokens: payload, updateInterval: 5 })
      console.log('Market: emitted subscribePositions for tokens', payload)
    } catch (e) {
      console.error('Market: failed to emit subscribePositions', e)
    }
  }, [])

  const syncFullQuotes = useCallback(async (tokenList: Array<{ exchange: string; token: string }>) => {
    if (!tokenList || tokenList.length === 0) return

    // Deduplicate tokens per exchange
    const dedupMap = new Map<string, { exchange: string; token: string }>()
    tokenList.forEach(item => {
      if (!item?.token) return
      const exchange = (item.exchange || 'NSE').toUpperCase()
      const key = `${exchange}:${item.token}`
      dedupMap.set(key, { exchange, token: String(item.token) })
    })

    if (dedupMap.size === 0) return

    try {
      const response = await fetch(`${API_BASE}/api/quotes/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: Array.from(dedupMap.values()) })
      })
      const json = await response.json()
      if (!json?.success || !Array.isArray(json.data)) return

      setStore(prev => {
        const copy: Record<string, MarketSymbolData> = { ...prev }
        json.data.forEach((quote: any) => {
          if (!quote) return
          const exchange = (quote.exchange || 'NSE').toUpperCase()
          const token = quote.token ? String(quote.token) : undefined
          const keyId = token ? `${exchange}:${token}` : undefined
          const meta = keyId ? tokenMetaRef.current.get(keyId) : undefined
          const symbolKey = meta?.symbol || quote.symbol || (token ? `Token_${token}` : undefined)
          if (!symbolKey) return

          console.log(`[MarketContext] 📊 Full quote for key="${symbolKey}" token=${token}: LTP=${quote.ltp}, low=${quote.low}, high=${quote.high}`)

          copy[symbolKey] = {
            ...(copy[symbolKey] || {}),
            ltp: quote.ltp ?? copy[symbolKey]?.ltp,
            token: token ? Number(token) : copy[symbolKey]?.token,
            exchange,
            timestamp: quote.timestamp || new Date().toISOString(),
            low: quote.low ?? copy[symbolKey]?.low,
            high: quote.high ?? copy[symbolKey]?.high,
            open: quote.open ?? copy[symbolKey]?.open,
            close: quote.close ?? copy[symbolKey]?.close,
            atp: quote.atp ?? copy[symbolKey]?.atp,
            volume: quote.volume ?? copy[symbolKey]?.volume,
            oi: quote.oi ?? copy[symbolKey]?.oi,
            percentChange: quote.percentChange ?? copy[symbolKey]?.percentChange,
            netChange: quote.netChange ?? copy[symbolKey]?.netChange,
            depth: quote.depth ?? copy[symbolKey]?.depth,
            lot_size: copy[symbolKey]?.lot_size,
          }
        })
        console.log('[MarketContext] 📊 After full quote sync, total keys:', Object.keys(copy).length)
        return copy
      })
    } catch (error) {
      console.error('Market: unable to sync full quotes', error)
    }
  }, [])

  // Poll for quotes at regular intervals to ensure real-time updates
  const startPolling = useCallback(() => {
    // Avoid starting multiple polling loops
    if (isPollingRef.current) return
    isPollingRef.current = true
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    // Poll every 2 seconds for live data (reduced frequency to avoid overload)
    pollingIntervalRef.current = setInterval(() => {
      if (pendingTokensRef.current.size === 0) return
      
      const tokenList = Array.from(pendingTokensRef.current).map(key => {
        const [exchange, token] = key.split(':')
        return { exchange, token }
      })
      
      // Only sync quotes, don't re-emit subscriptions every interval
      syncFullQuotes(tokenList)
    }, 2000) // Poll every 2 seconds
    
    console.log('[MarketContext] 🔄 Started polling for real-time updates')
  }, [syncFullQuotes])

  const stopPolling = useCallback(() => {
    isPollingRef.current = false
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log('[MarketContext] ⏹️ Stopped polling')
    }
  }, [])

  const subscribeTokens = useCallback((tokens: TokenInput[]) => {
    try {
      if (!Array.isArray(tokens) || tokens.length === 0) return

      console.log('[MarketContext] 📝 subscribeTokens called with:', tokens)

      const formatted = tokens
        .map(token => {
          if (token == null) return null
          if (typeof token === 'object' && 'token' in token) {
            return {
              token: String(token.token),
              exchange: (token.exchange || 'NSE').toUpperCase(),
              symbol: token.symbol,
            }
          }
          return { token: String(token), exchange: 'NSE' }
        })
        .filter(Boolean) as Array<{ token: string; exchange: string; symbol?: string }>

      if (formatted.length === 0) return

      console.log('[MarketContext] 📝 Formatted tokens for subscription:', formatted)

      formatted.forEach(({ token, exchange, symbol }) => {
        const key = `${exchange}:${token}`
        pendingTokensRef.current.add(key)
        tokenMetaRef.current.set(key, { exchange, symbol })
        console.log(`[MarketContext] Added to pending: ${key} -> ${symbol}`)
      })

      emitPendingSubscriptions()
      syncFullQuotes(formatted.map(({ exchange, token }) => ({ exchange, token })))
      
      // Start polling for continuous updates (only starts once)
      startPolling()
    } catch (error) {
      console.error('Market: failed to subscribe tokens', error)
    }
  }, []) // Empty deps - use refs for any mutable state

  useEffect(() => {
    // Connect to backend Socket.IO server
    try {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000
      })
      socketRef.current = socket

      socket.on('connect', () => {
        setConnected(true)
        console.log('Market: connected to position WebSocket server')
        emitPendingSubscriptions()
      })

      socket.on('disconnect', (reason: any) => {
        setConnected(false)
        console.log('Market: disconnected from position WebSocket server', reason)
      })

      socket.on('positionUpdate', (payload: any) => {
        try {
          const positions = payload?.positions || []
          if (positions.length === 0) return
          
          // Debug: show incoming positions for troubleshooting
          console.log('[MarketContext] 📡 positionUpdate received:', {
            positionsCount: positions.length,
            sample: positions.slice(0, 2),
          })
          
          // positions are expected to be parsed market ticks forwarded from backend
          // Example item: { symbol: 'NIFTY 50', token: 26000, ltp: 21123.45, timestamp: '...' }
          setStore(prev => {
            let hasChanges = false
            const copy = { ...prev }
            
            for (const p of positions) {
              const key = (p.symbol || p.symbolName || p.name || `Token_${p.token || ''}`).toString()
              const existing = copy[key]
              const newLtp = p.ltp != null ? Number(p.ltp) : existing?.ltp
              
              // Only update if there's actually new data
              if (newLtp !== existing?.ltp || !existing) {
                hasChanges = true
                copy[key] = {
                  ...(existing || {}),
                  ltp: newLtp,
                  token: p.token != null ? Number(p.token) : existing?.token,
                  timestamp: p.timestamp || new Date().toISOString(),
                  low: p.low ?? existing?.low,
                  high: p.high ?? existing?.high,
                  open: p.open ?? existing?.open,
                  close: p.close ?? existing?.close,
                  oi: p.oi ?? existing?.oi,
                  percentChange: p.percentChange ?? p.changePercent ?? existing?.percentChange,
                  netChange: p.netChange ?? p.change ?? existing?.netChange,
                  depth: p.depth ?? existing?.depth,
                  volume: p.volume ?? existing?.volume,
                  lot_size: p.lot_size || existing?.lot_size
                }
              }
            }
            
            // Only return new object if there are actual changes
            return hasChanges ? copy : prev
          })
        } catch (e) {
          console.error('Market: failed to handle positionUpdate', e)
        }
      })

      socket.on('initialPositions', (payload: any) => {
        try {
          const positions = payload?.positions || []
          const map: Record<string, any> = {}
          for (const p of positions) {
            const key = (p.symbol || p.symbolName || p.name || `Token_${p.token || ''}`).toString()
            map[key] = {
              ltp: p.ltp != null ? Number(p.ltp) : undefined,
              token: p.token != null ? Number(p.token) : undefined,
              timestamp: p.timestamp || new Date().toISOString(),
              low: p.low,
              high: p.high,
              open: p.open,
              close: p.close,
              oi: p.oi,
              percentChange: p.percentChange ?? p.changePercent,
              netChange: p.netChange ?? p.change,
              depth: p.depth,
              volume: p.volume,
            }
          }
          setStore(prev => ({ ...prev, ...map }))
          // Debug: load initial map into window variable for inspection
          try { (window as any)._marketSymbolsDebug = map } catch (e) {}
        } catch (e) {
          console.error('Market: failed to handle initialPositions', e)
        }
      })

      socket.on('connect_error', (err: any) => {
        console.error('Market: socket connect_error', err)
        setConnected(false)
      })

      return () => {
        try {
          socket.off('positionUpdate')
          socket.off('initialPositions')
          socket.disconnect()
          // Stop polling on cleanup
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('Market: failed to initialize socket', e)
    }
  }, [])

  // Register defaults once after mount
  useEffect(() => {
    if (!defaultsRegisteredRef.current && DEFAULT_TOKENS.length > 0) {
      defaultsRegisteredRef.current = true
      subscribeTokens(DEFAULT_TOKENS)
    }
  }, []) // Run only once on mount
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Use a stable reference for subscribeTokens
  const subscribeTokensRef = useRef(subscribeTokens)
  subscribeTokensRef.current = subscribeTokens

  const stableSubscribeTokens = useCallback((tokens: TokenInput[]) => {
    subscribeTokensRef.current(tokens)
  }, [])

  const state = useMemo(
    () => ({ symbols: store, connected, subscribeTokens: stableSubscribeTokens }),
    [store, connected, stableSubscribeTokens],
  )

  return <MarketContext.Provider value={state}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
