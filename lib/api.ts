// API utility functions for backend communication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface SymbolData {
  symbol_id: number;
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  token: string;
  instrument_type: string;
  strike_price?: number;
  expiry_date?: string;
  option_type?: string;
  lot_size?: number;
}

export interface OptionChainItem {
  strike_price: number;
  CE: SymbolData | null;
  PE: SymbolData | null;
}

export interface QuoteData {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  lastTradeQty: number;
  exchFeedTime: string;
  exchTradeTime: string;
  netChange: number;
  percentChange: number;
  avgPrice: number;
  tradeVolume: number;
  opnInterest: number;
  lowerCircuit: number;
  upperCircuit: number;
  totBuyQuan: number;
  totSellQuan: number;
  _52WeekLow: number;
  _52WeekHigh: number;
}

// Get all exchanges
export async function getExchanges(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/exchanges`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Get segments by exchange
export async function getSegments(exchange: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/segments?exchange=${exchange}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Get symbols by exchange and segment
export async function getSymbols(exchange: string, segment: string): Promise<SymbolData[]> {
  const response = await fetch(`${API_BASE_URL}/symbols?exchange=${exchange}&segment=${segment}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Get symbol token
export async function getSymbolToken(symbol: string, exchange: string): Promise<SymbolData> {
  const response = await fetch(`${API_BASE_URL}/symbol/${symbol}?exchange=${exchange}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Get quote data
export async function getQuoteData(exchangeTokens: Record<string, string[]>): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ exchangeTokens }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Search symbols
export async function searchSymbols(
  searchTerm: string,
  exchange?: string,
  segment?: string
): Promise<SymbolData[]> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ searchTerm, exchange, segment }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Get option chain
export async function getOptionChain(
  underlying: string,
  expiry?: string
): Promise<OptionChainItem[]> {
  const url = expiry
    ? `${API_BASE_URL}/option-chain/${underlying}?expiry=${expiry}`
    : `${API_BASE_URL}/option-chain/${underlying}`;
  
  const response = await fetch(url);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Health check
export async function checkHealth(): Promise<{ status: string; websocket: boolean }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return { status: data.status, websocket: data.websocket };
}
