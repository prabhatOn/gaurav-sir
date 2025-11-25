'use client'

import React from 'react'

interface SymbolSelectProps {
  value: string
  onChange: (s: string) => void
}

// Popular stocks and indices shown initially
const POPULAR_SYMBOLS = [
  // Indices
  { symbol: 'Nifty 50', name: 'Nifty 50', group: 'Index' },
  { symbol: 'Nifty Bank', name: 'Nifty Bank', group: 'Index' },
  { symbol: 'FINNIFTY', name: 'Fin Nifty', group: 'Index' },
  { symbol: 'MIDCPNIFTY', name: 'Midcap Nifty', group: 'Index' },
  { symbol: 'SENSEX', name: 'Sensex', group: 'Index' },
  { symbol: 'BANKEX', name: 'Bankex', group: 'Index' },
  // Popular Stocks
  { symbol: 'RELIANCE-EQ', name: 'Reliance Industries', group: 'Stock' },
  { symbol: 'TCS-EQ', name: 'Tata Consultancy', group: 'Stock' },
  { symbol: 'HDFCBANK-EQ', name: 'HDFC Bank', group: 'Stock' },
  { symbol: 'INFY-EQ', name: 'Infosys', group: 'Stock' },
  { symbol: 'ICICIBANK-EQ', name: 'ICICI Bank', group: 'Stock' },
  { symbol: 'SBIN-EQ', name: 'State Bank of India', group: 'Stock' },
  { symbol: 'BHARTIARTL-EQ', name: 'Bharti Airtel', group: 'Stock' },
  { symbol: 'ITC-EQ', name: 'ITC', group: 'Stock' },
  { symbol: 'KOTAKBANK-EQ', name: 'Kotak Bank', group: 'Stock' },
  { symbol: 'LT-EQ', name: 'Larsen & Toubro', group: 'Stock' },
  { symbol: 'HINDUNILVR-EQ', name: 'Hindustan Unilever', group: 'Stock' },
  { symbol: 'BAJFINANCE-EQ', name: 'Bajaj Finance', group: 'Stock' },
  { symbol: 'TATASTEEL-EQ', name: 'Tata Steel', group: 'Stock' },
  { symbol: 'TATAMOTORS-EQ', name: 'Tata Motors', group: 'Stock' },
  { symbol: 'WIPRO-EQ', name: 'Wipro', group: 'Stock' },
  { symbol: 'AXISBANK-EQ', name: 'Axis Bank', group: 'Stock' },
  { symbol: 'MARUTI-EQ', name: 'Maruti Suzuki', group: 'Stock' },
  { symbol: 'ADANIENT-EQ', name: 'Adani Enterprises', group: 'Stock' },
  { symbol: 'SUNPHARMA-EQ', name: 'Sun Pharma', group: 'Stock' },
  { symbol: 'ONGC-EQ', name: 'ONGC', group: 'Stock' },
]

export default React.memo(function SymbolSelect({ value, onChange }: SymbolSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<Array<any>>([])
  const [loading, setLoading] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || 'http://localhost:5000'

  // Search from database when user types
  React.useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `${BACKEND_BASE}/api/symbols/search?q=${encodeURIComponent(query)}&limit=50`
        console.log('[SymbolSelect] Searching:', url)
        const resp = await fetch(url)
        const json = await resp.json()
        let list = json?.data || []
        if (!Array.isArray(list)) list = []
        
        // Map results
        const mapped = list.map((it: any) => ({
          symbol: it.symbol || it.tradingsymbol || '',
          name: it.name || it.symbol || '',
          group: (it.segment === 'Index' || it.instrument_type === 'AMXIDX') ? 'Index' : 'Stock'
        }))
        
        console.log('[SymbolSelect] Found', mapped.length, 'results')
        setSearchResults(mapped)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, BACKEND_BASE])

  // Use search results if searching, otherwise show popular symbols
  const displayList = query.trim() ? searchResults : POPULAR_SYMBOLS

  // Group by Index/Stock
  const grouped = React.useMemo(() => {
    const byGroup: Record<string, any[]> = { Index: [], Stock: [] }
    displayList.forEach(s => {
      (byGroup[s.group] ||= []).push(s)
    })
    return byGroup
  }, [displayList])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter') setOpen(v => !v) }}
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white cursor-pointer flex items-center justify-between"
      >
        <span className="truncate">{value || 'Select symbol'}</span>
        <svg className="w-3 h-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
        </svg>
      </div>

      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg">
          <div className="p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol..."
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-auto text-sm">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">Searching...</div>
            ) : displayList.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-gray-500">
                No results found for "{query}"
              </div>
            ) : (
              ['Index', 'Stock'].map(group => (
                grouped[group].length > 0 && (
                  <div key={group} className="px-2 py-1">
                    <div className="text-xs text-gray-500 font-semibold px-1 py-1 border-b">{group}</div>
                    {grouped[group].map((sym: any) => (
                      <div
                        key={sym.symbol}
                        onClick={() => { 
                          onChange(sym.symbol)
                          setOpen(false)
                          setQuery('')
                        }}
                        className={`px-2 py-1.5 cursor-pointer rounded hover:bg-gray-100 ${value === sym.symbol ? 'bg-blue-50 font-medium' : ''}`}
                      >
                        <div className="font-medium">{sym.symbol}</div>
                        {sym.name !== sym.symbol && (
                          <div className="text-xs text-gray-400">{sym.name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
})
