'use client'

import React from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMarket } from '@/components/market/market-context'

interface OptimizedSymbolSelectProps {
  value: string
  onChange: (symbol: string) => void
  exchange?: string
  segment?: string
}

export default function OptimizedSymbolSelect({ 
  value, 
  onChange, 
  exchange = 'NSE',
  segment = 'Index' 
}: OptimizedSymbolSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [symbols, setSymbols] = React.useState<any[]>([])
  const [indices, setIndices] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  
  const market = useMarket()
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

  // Load indices on mount and subscribe to their tokens
  React.useEffect(() => {
    const loadIndices = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/indices`)
        const json = await res.json()
        if (json.success && json.data) {
          setIndices(json.data)
          
          // Subscribe to real-time updates for all indices
          if (market.subscribeTokens) {
            const tokens = json.data
              .filter((idx: any) => idx.token)
              .map((idx: any) => ({
                token: idx.token,
                exchange: idx.exchange || 'NSE',
                symbol: idx.symbol
              }))
            
            if (tokens.length > 0) {
              console.log('[OptimizedSymbolSelect] Subscribing to indices:', tokens)
              market.subscribeTokens(tokens)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load indices:', error)
      }
    }
    loadIndices()
  }, [BACKEND_URL, market.subscribeTokens])

  // Search symbols on demand (debounced)
  React.useEffect(() => {
    if (!search || search.length < 2) {
      setSymbols([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          q: search,
          limit: '50'
        })
        if (exchange) params.append('exchange', exchange)
        if (segment) params.append('segment', segment)

        const res = await fetch(`${BACKEND_URL}/api/symbols/search?${params}`)
        const json = await res.json()
        
        if (json.success && json.data) {
          setSymbols(json.data)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, exchange, segment, BACKEND_URL])

  // Combine indices and search results
  const displayItems = search && search.length >= 2 ? symbols : indices

  const selectedSymbol = displayItems.find(s => s.symbol === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedSymbol ? (
            <span className="truncate">
              {selectedSymbol.symbol} {selectedSymbol.name && `- ${selectedSymbol.name}`}
            </span>
          ) : (
            "Select symbol..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search symbols..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Searching...
              </div>
            ) : displayItems.length === 0 ? (
              <CommandEmpty>
                {search && search.length >= 2 
                  ? "No symbols found." 
                  : "Type to search symbols..."}
              </CommandEmpty>
            ) : (
              <CommandGroup heading={search ? "Search Results" : "Indices"}>
                {displayItems.map((symbol) => (
                  <CommandItem
                    key={symbol.symbol_id || symbol.token}
                    value={symbol.symbol}
                    onSelect={() => {
                      onChange(symbol.symbol)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === symbol.symbol ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="font-medium">{symbol.symbol}</div>
                      {symbol.name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {symbol.name}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground ml-2">
                      {symbol.exchange}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
