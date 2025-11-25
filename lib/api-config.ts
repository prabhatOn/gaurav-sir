/**
 * Centralized API configuration
 * All API calls should use these base URLs
 */

// Backend API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// WebSocket URL for real-time data
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Legacy support (if old backend is still needed)
export const LEGACY_API_URL = process.env.NEXT_PUBLIC_LEGACY_API_URL || 'http://localhost:3010/api';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  // Market Data
  exchanges: '/exchanges',
  segments: '/segments',
  symbols: '/symbols',
  symbol: (symbol: string) => `/symbol/${symbol}`,
  quote: '/quote',
  search: '/search',
  optionChain: (underlying: string) => `/option-chain/${underlying}`,
  health: '/health',

  // Orders
  orders: '/orders',
  order: (orderId: string) => `/orders/${orderId}`,
  cancelOrder: (orderId: string) => `/orders/${orderId}/cancel`,
  cancelAllOrders: '/orders/cancel-all',

  // Positions
  positions: '/positions',
  closePosition: (positionId: string) => `/positions/${positionId}/close`,
  closeAllPositions: '/positions/close-all',

  // Trades
  trades: '/trades',

  // Brokers
  brokers: '/brokers',
  broker: (brokerId: string) => `/brokers/${brokerId}`,
  brokerHealth: '/brokers/health',
  brokerOrders: (brokerId: string) => `/brokers/${brokerId}/orders`,
  brokerPositions: (brokerId: string) => `/brokers/${brokerId}/positions`,

  // Baskets
  baskets: '/baskets',
  basket: (basketId: string) => `/baskets/${basketId}`,
  placeBasket: (basketId: string) => `/baskets/${basketId}/place`,

  // Funds
  funds: '/funds',
  brokerFunds: (brokerId: string) => `/brokers/${brokerId}/funds`,

  // Holdings
  holdings: '/holdings',

  // Accounts
  accounts: '/accounts',

  // P&L
  realizedPnl: '/realized-pnl',

  // Settings
  columnSettings: (table: string) => `/column-settings/${table}`,

  // Symbol Details (extended)
  symbolDetails: (symbol: string) => `/symbols/${symbol}`,
  symbolExpiries: (symbol: string) => `/symbols/${symbol}/expiries`,
  symbolStrikes: (symbol: string, expiry: string) => `/symbols/${symbol}/expiries/${encodeURIComponent(expiry)}/strikes`,
};

/**
 * Helper function to build full URL
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const url = new URL(API_BASE_URL + endpoint);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * API client with common methods
 */
export const apiClient = {
  async get(endpoint: string, params?: Record<string, any>) {
    const url = buildUrl(endpoint, params);
    const response = await fetch(url);
    return response.json();
  },

  async post(endpoint: string, data?: any) {
    const url = API_BASE_URL + endpoint;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async put(endpoint: string, data?: any) {
    const url = API_BASE_URL + endpoint;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(endpoint: string) {
    const url = API_BASE_URL + endpoint;
    const response = await fetch(url, {
      method: 'DELETE',
    });
    return response.json();
  },
};
