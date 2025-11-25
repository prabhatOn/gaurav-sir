import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export interface MarketDataPayload {
  token?: string;
  exchange?: string;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp?: number;
  [key: string]: any;
}

export interface SubscriptionToken {
  exchange: string;
  token: string;
}

export function useBackendSocket() {
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState<Record<string, MarketDataPayload>>({});
  const socketRef = useRef<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to backend Socket.IO server');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend Socket.IO server');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setError(err.message);
      setConnected(false);
    });

    socket.on('marketData', (payload: MarketDataPayload | MarketDataPayload[]) => {
      const updates = Array.isArray(payload) ? payload : [payload];

      if (updates.length === 0) {
        return;
      }

      setMarketData((prev) => {
        const next = { ...prev };

        updates.forEach((data) => {
          if (!data) return;
          const key = data.token || data.exchange;
          if (!key) return;
          next[key] = data;
        });

        return next;
      });
    });

    socket.on('subscribed', (data) => {
      console.log('✅ Subscribed to symbols:', data);
    });

    socket.on('unsubscribed', (data) => {
      console.log('📴 Unsubscribed from symbols:', data);
    });

    socket.on('error', (data) => {
      console.error('❌ Socket error:', data);
      setError(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((tokens: SubscriptionToken[], mode: number = 3) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { tokens, mode });
      console.log('📡 Subscribing to tokens:', tokens);
    } else {
      console.warn('⚠️ Socket not connected, cannot subscribe');
    }
  }, []);

  const unsubscribe = useCallback((tokens: SubscriptionToken[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', { tokens });
      console.log('📴 Unsubscribing from tokens:', tokens);
    }
  }, []);

  const getSubscriptions = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getSubscriptions');
    }
  }, []);

  return {
    connected,
    marketData,
    error,
    subscribe,
    unsubscribe,
    getSubscriptions,
    socket: socketRef.current,
  };
}
