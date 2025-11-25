"use client"
import React from 'react'
import { useMarket } from '@/components/market/market-context'

interface PriceChartProps {
  title: string
  symbol: string
  strikePrice?: string
  expiry?: string
  leftLabel?: string
  leftValue?: string
  middleLabel?: string
  middleValue?: string
  rightLabel?: string
  rightValue?: string
  textColor?: 'text-red-600' | 'text-green-600'
  positionType?: 'CE' | 'PE'
  noBorder?: boolean
  marketKey?: string
}

// Separate component for just the LTP value to minimize re-renders
const LiveLTP = React.memo(function LiveLTP({ value }: { value: number | undefined }) {
  return <>{value != null ? value.toFixed(2) : '—'}</>
})

// Separate component for delta display
const LiveDelta = React.memo(function LiveDelta({ 
  delta, 
  deltaPct 
}: { 
  delta: number | null
  deltaPct: number | null 
}) {
  if (delta == null || deltaPct == null) return <>(—)</>
  const isNegative = delta < 0
  const isPositive = delta > 0
  return (
    <span className={isNegative ? 'text-red-600' : isPositive ? 'text-green-600' : 'text-gray-600'}>
      ({isPositive ? '+' : ''}{delta.toFixed(2)} / {isPositive ? '+' : ''}{deltaPct.toFixed(2)}%)
    </span>
  )
})

// Separate component for the position dot on the slider
const PositionDot = React.memo(function PositionDot({ percentage }: { percentage: number }) {
  return (
    <div 
      className="absolute" 
      style={{ 
        width: 8, 
        height: 8, 
        borderRadius: 9999, 
        backgroundColor: '#222',
        left: `${percentage}%`, 
        top: '50%', 
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.15s linear'
      }} 
    />
  )
})

// Separate component for Low/High values
const LiveLowHigh = React.memo(function LiveLowHigh({ low, high }: { low: number; high: number }) {
  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs text-gray-600">L: <span className="font-medium">{low > 0 ? low.toFixed(2) : '—'}</span></span>
      <span className="text-xs font-medium"></span>
      <span className="text-xs text-gray-600">H: <span className="font-medium">{high > 0 ? high.toFixed(2) : '—'}</span></span>
    </div>
  )
})

const PriceChart = React.memo(function PriceChart({
  title,
  symbol,
  strikePrice,
  expiry,
  positionType,
  noBorder,
  marketKey,
}: PriceChartProps) {
  const market = useMarket()
  
  // Normalize symbol to handle various name formats
  const normalizedSymbol = React.useMemo(() => {
    const upper = (symbol || '').toUpperCase().trim()
    if (upper === 'NIFTY BANK' || upper === 'BANKNIFTY' || upper === 'BANK NIFTY') return 'Nifty Bank'
    if (upper === 'NIFTY' || upper === 'NIFTY 50' || upper === 'NIFTY50') return 'Nifty 50'
    return symbol
  }, [symbol])
  
  // Try multiple keys to find the best match
  const marketData = React.useMemo(() => {
    if (marketKey && market.symbols[marketKey]) return market.symbols[marketKey]
    if (market.symbols[normalizedSymbol]) return market.symbols[normalizedSymbol]
    if (market.symbols[symbol]) return market.symbols[symbol]
    
    const keys = Object.keys(market.symbols)
    const upperSymbol = (symbol || '').toUpperCase()
    const upperNormalized = (normalizedSymbol || '').toUpperCase()
    
    let found = keys.find(k => k.toUpperCase() === upperSymbol || k.toUpperCase() === upperNormalized)
    if (found) return market.symbols[found]
    
    found = keys.find(k => {
      const upper = k.toUpperCase()
      return upper.includes(upperSymbol) || upper.includes(upperNormalized) || upperSymbol.includes(upper)
    })
    return found ? market.symbols[found] : undefined
  }, [market.symbols, marketKey, normalizedSymbol, symbol])
  
  // Extract values - these update when marketData changes
  const liveLtp = marketData?.ltp ?? undefined
  const low = marketData?.low ?? (liveLtp != null ? Number((liveLtp * 0.98).toFixed(2)) : 0)
  const high = marketData?.high ?? (liveLtp != null ? Number((liveLtp * 1.02).toFixed(2)) : 0)
  const netChange = marketData?.netChange ?? null
  const percentChange = marketData?.percentChange ?? null
  
  // Calculate position percentage
  const range = high - low
  let positionPercentage = 50
  if (range > 0 && liveLtp != null) {
    positionPercentage = ((liveLtp - low) / range) * 100
    positionPercentage = Math.max(0, Math.min(100, positionPercentage))
  }
  
  const markerColor = '#7b3b3b'

  // Compute delta from previous if market data doesn't have it
  const prevRef = React.useRef<number | undefined>(undefined)
  const [computedDelta, setComputedDelta] = React.useState<number | null>(null)
  const [computedDeltaPct, setComputedDeltaPct] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (liveLtp === undefined) return
    if (netChange != null && percentChange != null) {
      setComputedDelta(netChange)
      setComputedDeltaPct(percentChange)
      prevRef.current = liveLtp
      return
    }
    const prev = prevRef.current
    if (prev != null && prev !== 0 && prev !== liveLtp) {
      const d = liveLtp - prev
      setComputedDelta(Number(d.toFixed(2)))
      setComputedDeltaPct(Number(((d / prev) * 100).toFixed(2)))
    }
    prevRef.current = liveLtp
  }, [liveLtp, netChange, percentChange])

  const delta = netChange ?? computedDelta
  const deltaPct = percentChange ?? computedDeltaPct

  return (
    <div className={`flex-1 min-w-full md:min-w-0 p-3 bg-white rounded${!noBorder ? ' border border-gray-200' : ''}`}>
      {/* Header - static, no re-render needed */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="text-xs text-gray-700 font-semibold">{title}</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs text-gray-500">{symbol}</p>
        </div>
        <div className="text-right flex-1">
          <p className="text-xs text-gray-500">{positionType || ''}</p>
        </div>
      </div>

      {/* Price slider */}
      <div className="mb-3">
        <LiveLowHigh low={low} high={high} />
        <div className="h-0.5 rounded-full relative" style={{ backgroundColor: markerColor }}>
          <div className="absolute" style={{ left: '0%', top: '-10px', transform: 'translateX(-50%)' }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 8L0 0H10L5 8Z" fill={markerColor} />
            </svg>
          </div>
          {liveLtp != null && <PositionDot percentage={positionPercentage} />}
          <div className="absolute" style={{ right: '0%', top: '-10px', transform: 'translateX(50%)' }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 8L0 0H10L5 8Z" fill={markerColor} />
            </svg>
          </div>
        </div>
      </div>

      {/* LTP Display */}
      <div className={`pt-3 ${!noBorder ? 'border-t border-gray-200' : ''}`}>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm font-medium text-gray-900">LTP: </span>
            <span className="text-lg font-bold text-gray-900">
              <LiveLTP value={liveLtp} />
            </span>
          </div>
          <span className="text-sm font-medium">
            <LiveDelta delta={delta} deltaPct={deltaPct} />
          </span>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these props change
  return prevProps.marketKey === nextProps.marketKey && 
         prevProps.title === nextProps.title &&
         prevProps.symbol === nextProps.symbol &&
         prevProps.positionType === nextProps.positionType
})
// Format expiry from DDMMYY -> DDMMMYY (e.g., 251125 -> 25NOV25)
function formatExpiry(code?: string) {
  if (!code) return ''
  // expecting DDMMYY
  if (!/^[0-9]{6}$/.test(code)) return code
  const dd = code.slice(0,2)
  const mm = code.slice(2,4)
  const yy = code.slice(4,6)
  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const mIndex = Number(mm) - 1
  const year = yy
  const mon = monthNames[mIndex] ?? mm
  return `${dd}${mon}${year}`
}

// Format expiry for key lookup: DD-MMM-YY
function formatExpiryForKey(exp: string) {
  if (exp.length === 6 && /^\d{6}$/.test(exp)) { // DDMMYY
    const dd = exp.slice(0,2)
    const mm = exp.slice(2,4)
    const yy = exp.slice(4,6)
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const mIndex = Number(mm) - 1
    const mon = monthNames[mIndex] ?? mm
    return `${dd}-${mon}-${yy}`
  }
  if (exp.match(/^\d{2}[A-Z]{3}\d{2}$/)) { // DDMMMYY
    const dd = exp.slice(0,2)
    const mmm = exp.slice(2,5)
    const yy = exp.slice(5,7)
    return `${dd}-${mmm}-${yy}`
  }
  return exp
}

export function PriceCharts() {
  const market = useMarket()
  const [selected, setSelected] = React.useState<string[]>([])
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null)

  // Helper: find market symbol key by numeric token
  const findKeyByToken = React.useCallback((tok?: string | number) => {
    if (!tok) return undefined
    const tnum = Number(tok)
    const entries = Object.entries(market.symbols || {})
    for (const [k, v] of entries) {
      if (v && v.token != null && Number(v.token) === tnum) return k
      // also match keys like 'Token_26000' or exact numeric string
      if (k === `Token_${tnum}`) return k
      if (k === String(tnum)) return k
    }
    return undefined
  }, [market.symbols])
  // Parse option-like labels into parts
  const parseOption = (input: string) => {
    const s = String(input || '').trim()
    const upper = s.toUpperCase()
    const typeMatch = upper.match(/\b(CE|PE)\b/)
    const expiryMatch = upper.match(/\b(\d{2}[A-Z]{3}\d{2})\b/) // DDMMMYY
    // strike: numeric token after expiry
    const strikeMatch = upper.match(/\b(\d{4,5})\b(?!\d)/)
    // underlying: remove type, expiry, strike tokens
    let underlying = upper.replace(/\b(CE|PE)\b/g, '')
    underlying = underlying.replace(/\b\d{2}[A-Z]{3}\d{2}\b/g, '')
    underlying = underlying.replace(/\b\d{4,5}\b/g, '')
    underlying = underlying.replace(/[^A-Z0-9 ]/g, ' ').trim()
    return {
      raw: s,
      type: typeMatch ? typeMatch[1] : undefined,
      expiry: expiryMatch ? expiryMatch[1] : undefined,
      strike: strikeMatch ? strikeMatch[1] : undefined,
      underlying: underlying || s
    }
  }

  // Resolve a market key best matching the provided token (exact -> includes -> stripped)
  const resolveMarketKey = (token: string | undefined) => {
    if (!token) return undefined
    const keys = Object.keys(market?.symbols || {})
    if (keys.length === 0) return undefined
    if (keys.includes(token)) return token
    const upper = token.toUpperCase()
    const found = keys.find(k => k.toUpperCase() === upper)
    if (found) return found
    const partial = keys.find(k => k.toUpperCase().includes(upper))
    if (partial) return partial
    const stripped = upper.replace(/[^A-Z0-9]/g, '')
    const found2 = keys.find(k => k.toUpperCase().replace(/[^A-Z0-9]/g, '') === stripped)
    if (found2) return found2
    return undefined
  }

  // More advanced resolver which accepts parsed details and prefers exact option contracts
  const resolveMarketKeyFor = (base: string, opts: { type?: string, strike?: string, expiry?: string } = {}) => {
    const keys = Object.keys(market?.symbols || {})
    if (!base || keys.length === 0) return undefined
    const upperBase = base.toUpperCase()

    // Helper to normalize
    const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // If expiry + strike + type provided, try to find exact token containing all
    if (opts.expiry || opts.strike || opts.type) {
      const formattedExpiry = opts.expiry ? formatExpiryForKey(opts.expiry) : undefined
      const candidates = keys.filter(k => {
        const u = k.toUpperCase()
        if (!u.includes(upperBase)) return false
        if (opts.type && !u.includes(opts.type.toUpperCase())) return false
        if (opts.strike && !u.match(new RegExp(`\\b${opts.strike}\\b`))) return false
        if (formattedExpiry && !u.includes(formattedExpiry)) return false
        return true
      })
      if (candidates.length > 0) return candidates[0]
    }

    // fallback: find any key that includes base + type
    if (opts.type) {
      const found = keys.find(k => k.toUpperCase().includes(upperBase) && k.toUpperCase().includes(opts.type.toUpperCase()))
      if (found) return found
    }

    // fallback: broader matches
    const foundAny = keys.find(k => k.toUpperCase().includes(upperBase))
    if (foundAny) return foundAny

    // last resort: stripped match
    const strippedBase = norm(base)
    const foundStripped = keys.find(k => norm(k).includes(strippedBase))
    return foundStripped
  }

  // Update charts when form data changes
  React.useEffect(() => {
    const handler = async (e: any) => {
      const data = e?.detail
      if (!data?.symbol) return
      const base = data.symbol
      const expiry = data.expiryDate || ''
      const callStrike = data.callStrike || ''
      const putStrike = data.putStrike || ''

      // Store token for underlying
      if (data.token) {
        setSelectedToken(data.token)
      }

      // If no expiry or strike selected, show underlying in center with placeholders
      if (!expiry || !callStrike) {
        // Show 3 charts: placeholder CE, underlying, placeholder PE
        setSelected(['Call Option', base, 'Put Option'])
        return
      }

      // Convert expiry to DDMMYY format for display
      const parts = expiry.split('-')
      if (parts.length === 3) {
        const dd = parts[0]
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        }
        const mm = monthMap[parts[1]] || '11'
        const yy = parts[2].slice(-2)
        const expiryCode = `${dd}${mm}${yy}`
        const formattedExpiry = formatExpiry(expiryCode)
        
        // Clean base symbol for option names (remove -EQ suffix)
        const cleanBase = base.replace(/-EQ$/, '').replace(/ /g, '')
        
        const left = `${cleanBase} ${formattedExpiry} ${callStrike} CE`
        const middle = base
        const right = `${cleanBase} ${formattedExpiry} ${putStrike} PE`
        setSelected([left, middle, right])
        
        // Fetch option contracts and subscribe to their tokens
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
          
          // Clean symbol for API (remove -EQ suffix)
          const apiSymbol = base.replace(/-EQ$/, '')
          
          const response = await fetch(
            `${BACKEND_URL}/api/symbols/${encodeURIComponent(apiSymbol)}/option-contracts?expiry=${encodeURIComponent(expiry)}&strike=${callStrike}`
          )
          const result = await response.json()
          
          console.log('[PriceCharts] Option contracts API response:', result)
          
          if (result.success && result.data) {
            const tokensToSubscribe = []
            
            // Add CE token - use the formatted display name (left) as the key
            if (result.data.ce?.token) {
              tokensToSubscribe.push({
                token: result.data.ce.token,
                exchange: result.data.ce.exchange || 'NFO',
                symbol: left  // Use our display format as the key
              })
              console.log('[PriceCharts] CE contract:', result.data.ce)
            }
            
            // Add PE token - use the formatted display name (right) as the key
            if (result.data.pe?.token) {
              tokensToSubscribe.push({
                token: result.data.pe.token,
                exchange: result.data.pe.exchange || 'NFO',
                symbol: right  // Use our display format as the key
              })
              console.log('[PriceCharts] PE contract:', result.data.pe)
            }
            
            // Add underlying token
            if (data.token) {
              tokensToSubscribe.push({
                token: data.token,
                exchange: data.exchange || 'NSE',
                symbol: base
              })
            }
            
            // Subscribe to all tokens for real-time updates
            if (tokensToSubscribe.length > 0 && market.subscribeTokens) {
              console.log('[PriceCharts] Subscribing to option tokens:', tokensToSubscribe)
              market.subscribeTokens(tokensToSubscribe)
            }
          }
        } catch (error) {
          console.error('[PriceCharts] Failed to fetch option contracts:', error)
        }
      }
    }

    window.addEventListener('tradeFormUpdated', handler as EventListener)
    return () => window.removeEventListener('tradeFormUpdated', handler as EventListener)
  }, [market.subscribeTokens])

  // Helper to build L/H labels from live LTP
  const buildLabels = React.useMemo(() => (symKey: string, parsed: any) => {
    const resolvedKey = resolveMarketKeyFor(parsed.underlying, { type: parsed.type, strike: parsed.strike, expiry: parsed.expiry }) || resolveMarketKey(symKey)
    const md = market.symbols[resolvedKey]
    const ltp = md?.ltp ?? undefined
    if (!md && ltp == null) return { leftLabel: 'L: —', rightLabel: 'H: —', middleLabel: '' }
    const low = md?.low ?? (ltp != null ? Number((ltp * 0.98).toFixed(2)) : '—')
    const high = md?.high ?? (ltp != null ? Number((ltp * 1.02).toFixed(2)) : '—')
    return { leftLabel: `L: ${low}`, rightLabel: `H: ${high}`, middleLabel: '' }
  }, [market.symbols])

  return (
    <div className="flex flex-col lg:flex-row gap-2">
      {/* Render charts without useMemo to ensure real-time updates */}
      {selected.length > 0 && selected.map((sym, idx) => {
        // attempt to extract strike/expiry for title details
        const p = parseOption(sym)
        const labels = buildLabels(sym, p)
        // decide CE/PE: left = CE, middle = underlying (no option), right = PE
        const pos = idx === 0 ? 'CE' : idx === 2 ? 'PE' : undefined
        const color = idx === 2 ? 'text-red-600' : idx === 1 ? 'text-gray-900' : 'text-green-600'
        // Prefer resolving with parsed details for better match on option contracts
        const resolvedKey = resolveMarketKeyFor(p.underlying, { type: p.type, strike: p.strike, expiry: p.expiry }) || resolveMarketKey(sym)
        const resolvedLtp = resolvedKey ? market.symbols[resolvedKey]?.ltp : market.symbols[sym]?.ltp
        // Prefer token for middle chart if available; resolve to actual market key
        let finalMarketKey = resolvedKey
        if (idx === 1 && selectedToken) {
          const byTok = findKeyByToken(selectedToken)
          if (byTok) finalMarketKey = byTok
        }
        const finalResolvedLtp = finalMarketKey ? market.symbols[finalMarketKey]?.ltp : market.symbols[sym]?.ltp
        
        // Try exact match first, then fallback to resolved key
        let bestMarketKey = market.symbols[sym] ? sym : finalMarketKey
        
        // Debug log
        try { 
          console.debug('[PriceCharts] Resolution for', sym, ':', { 
            idx, 
            exactMatch: !!market.symbols[sym],
            resolvedKey, 
            finalMarketKey: bestMarketKey, 
            finalResolvedLtp,
            availableKeys: Object.keys(market.symbols).filter(k => k.includes(p.underlying)).slice(0, 5)
          }) 
        } catch (e) {}
        
        return (
          <PriceChart
            key={sym + idx}
            title={sym}
            symbol={p.underlying}
            strikePrice={p.strike}
            expiry={p.expiry}
            positionType={pos as any}
            leftLabel={labels.leftLabel}
            rightLabel={labels.rightLabel}
            middleLabel={labels.middleLabel}
            middleValue={finalResolvedLtp != null ? String(Number(finalResolvedLtp).toFixed(2)) : undefined}
            marketKey={bestMarketKey}
            textColor={color as any}
            noBorder={true}
          />
        )
      })}
    </div>
  )
}
