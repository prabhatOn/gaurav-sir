import { useEffect, useRef, useState } from 'react'

export type LtpMessage = {
  type: 'ltp'
  data: {
    mode: number
    exchangeType: string
    token: number
    sequence: number
    timestamp: string
    ltp: number
    symbol?: string
  }
}

export type ControlMessage = {
  type: 'control'
  data: any
}

export function useAngelSocket() {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Array<LtpMessage | ControlMessage>>([])
  const [latest, setLatest] = useState<Record<string, any>>({})
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // connect to local backend websocket server
    let ws: WebSocket | null = null
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Try a list of candidate ports so the client can auto-detect the backend
    const candidatePorts = [
      (process.env.NEXT_PUBLIC_MARKET_WS_PORT as string) || '3010',
      '3000'
    ]

    const connectToCandidate = (idx = 0) => {
      if (idx >= candidatePorts.length) {
        console.warn('[useAngelSocket] Unable to connect to any market socket port')
        setConnected(false)
        return
      }

      const port = candidatePorts[idx]
      const url = `${protocol}://${window.location.hostname}:${port}`
      console.debug('[useAngelSocket] Trying market websocket at', url)

      ws = new WebSocket(url)
      wsRef.current = ws
    wsRef.current = ws

      ws.addEventListener('open', () => {
        console.debug('[useAngelSocket] Connected to market websocket:', url)
        setConnected(true)
      })

      ws.addEventListener('message', (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        if (payload.type === 'ltp') {
          setMessages((prev) => {
            const newMessages = [...prev, payload]
            // Keep only last 100 messages to prevent memory issues
            return newMessages.length > 100 ? newMessages.slice(-100) : newMessages
          })
          // maintain a latest map keyed by token (and symbol as fallback)
          const key = payload.data.token ? String(payload.data.token) : (payload.data.symbol || '')
          // Debug log for browser console
          try { console.debug('[useAngelSocket] LTP payload', key, payload.data) } catch (e) {}
          setLatest((prev) => ({ ...prev, [key]: payload.data }))
        } else if (payload.type === 'control' || payload.type === 'status') {
          setMessages((prev) => [...prev, payload])
        }
      } catch (e) {
        console.error('Error parsing incoming message', e)
      }
    })

      ws.addEventListener('close', () => {
        console.warn('[useAngelSocket] market websocket closed', url)
        setConnected(false)
      })

      ws.addEventListener('error', (err) => {
        console.error('[useAngelSocket] market websocket error', err)
        // Try next candidate port
        connectToCandidate(idx + 1)
      })
    }

    connectToCandidate()

    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const send = (obj: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj))
    }
  }

  return { connected, messages, latest, send }
}
