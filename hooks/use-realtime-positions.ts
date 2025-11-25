import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Position {
  symbol: string;
  exchange: string;
  instrumentType: string;
  totalQuantity: number;
  weightedAvgPrice: number;
  totalValue: number;
  brokers: Array<{
    brokerId: number;
    brokerName: string;
    quantity: number;
    averagePrice: number;
    pnl: number;
    pnlPercentage: number;
    updatedAt: string;
  }>;
  pnl: number;
  pnlPercentage: number;
}

interface PositionHealth {
  brokerId: number;
  brokerName: string;
  lastPositionSync: string | null;
  loadStats: {
    activeOrders: number;
    pendingOrders: number;
    failedOrdersToday: number;
    successRate: number;
    averageResponseTimeMs: number;
    lastUpdated: string;
  } | null;
  isActive: boolean;
}

interface UseRealtimePositionsOptions {
  brokerId?: number | 'all';
  autoConnect?: boolean;
  updateInterval?: number;
  maxAgeMinutes?: number;
}

interface UseRealtimePositionsReturn {
  positions: Position[];
  loading: boolean;
  error: string | null;
  health: PositionHealth[];
  lastUpdated: Date | null;
  reconnect: () => void;
  forceSync: () => Promise<void>;
  reconcilePositions: (brokerId: number) => Promise<void>;
  subscribe: (brokerId?: number | 'all') => void;
  unsubscribe: (brokerId?: number | 'all') => void;
}

/**
 * React hook for real-time position updates via WebSocket
 */
export function useRealtimePositions(options: UseRealtimePositionsOptions = {}): UseRealtimePositionsReturn {
  const {
    brokerId = 'all',
    autoConnect = true,
    updateInterval = 30,
    maxAgeMinutes = 5
  } = options;

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<PositionHealth[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  // Generate unique request ID
  const getRequestId = useCallback(() => {
    return `req_${++requestIdRef.current}_${Date.now()}`;
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    try {
      socketRef.current = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true,
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('📡 Connected to position WebSocket server');
        setError(null);

        // Subscribe to position updates
        socket.emit('subscribePositions', {
          brokerId,
          updateInterval
        });

        // Get initial data
        socket.emit('getPositions', {
          brokerId,
          maxAgeMinutes,
          requestId: getRequestId()
        });

        socket.emit('getPositionHealth');
      });

      socket.on('disconnect', (reason) => {
        console.log('📡 Disconnected from position WebSocket server:', reason);
        setLoading(false);

        // Auto-reconnect
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      });

      socket.on('connect_error', (err) => {
        console.error('📡 WebSocket connection error:', err);
        setError(`Connection failed: ${err.message}`);
        setLoading(false);
      });

      // Data events
      socket.on('initialPositions', (data) => {
        console.log('📡 Received initial positions:', data);
        setPositions(data.positions || []);
        setLastUpdated(new Date(data.timestamp));
        setLoading(false);
      });

      socket.on('positionUpdate', (data) => {
        console.log('📡 Position update received:', data);
        if (data.brokerId === brokerId || brokerId === 'all') {
          setPositions(data.positions || []);
          setLastUpdated(new Date(data.timestamp));
        }
      });

      socket.on('positionsData', (data) => {
        if (data.success) {
          setPositions(data.positions || []);
          setLastUpdated(new Date(data.timestamp));
          setError(null);
        } else {
          setError(data.error || 'Failed to load positions');
        }
        setLoading(false);
      });

      socket.on('positionHealth', (data) => {
        if (data.success) {
          setHealth(data.health || []);
        }
      });

      socket.on('forceSyncComplete', (data) => {
        console.log('📡 Force sync completed:', data);
        // Refresh positions after sync
        socket.emit('getPositions', {
          brokerId,
          maxAgeMinutes: 1, // Get fresh data
          requestId: getRequestId()
        });
      });

      socket.on('reconciliationComplete', (data) => {
        console.log('📡 Reconciliation completed:', data);
        if (data.success) {
          // Refresh positions after reconciliation
          socket.emit('getPositions', {
            brokerId: data.brokerId,
            maxAgeMinutes: 1,
            requestId: getRequestId()
          });
        }
      });

      socket.on('error', (data) => {
        console.error('📡 WebSocket error:', data);
        setError(data.message || 'WebSocket error occurred');
      });

      socket.on('subscriptionConfirmed', (data) => {
        console.log('📡 Subscription confirmed:', data);
      });

      socket.on('unsubscriptionConfirmed', (data) => {
        console.log('📡 Unsubscription confirmed:', data);
      });

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to initialize WebSocket connection');
      setLoading(false);
    }
  }, [brokerId, updateInterval, maxAgeMinutes, getRequestId]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Reconnect to WebSocket server
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 1000);
  }, [connect, disconnect]);

  // Force position sync
  const forceSync = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Force sync timeout'));
      }, 30000);

      socketRef.current.emit('forcePositionSync', { brokerId });

      const handleSyncComplete = (data: any) => {
        clearTimeout(timeout);
        socketRef.current?.off('forceSyncComplete', handleSyncComplete);
        if (data.brokerId === brokerId || brokerId === 'all') {
          resolve();
        }
      };

      socketRef.current.on('forceSyncComplete', handleSyncComplete);
    });
  }, [brokerId]);

  // Reconcile positions
  const reconcilePositions = useCallback(async (targetBrokerId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Reconciliation timeout'));
      }, 30000);

      socketRef.current.emit('reconcilePositions', { brokerId: targetBrokerId });

      const handleReconciliationComplete = (data: any) => {
        clearTimeout(timeout);
        socketRef.current?.off('reconciliationComplete', handleReconciliationComplete);
        if (data.brokerId === targetBrokerId) {
          resolve();
        }
      };

      socketRef.current.on('reconciliationComplete', handleReconciliationComplete);
    });
  }, []);

  // Subscribe to position updates
  const subscribe = useCallback((targetBrokerId?: number | 'all') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribePositions', {
        brokerId: targetBrokerId || brokerId,
        updateInterval
      });
    }
  }, [brokerId, updateInterval]);

  // Unsubscribe from position updates
  const unsubscribe = useCallback((targetBrokerId?: number | 'all') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribePositions', {
        brokerId: targetBrokerId || brokerId
      });
    }
  }, [brokerId]);

  // Initialize connection
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    positions,
    loading,
    error,
    health,
    lastUpdated,
    reconnect,
    forceSync,
    reconcilePositions,
    subscribe,
    unsubscribe
  };
}

export type { Position, PositionHealth, UseRealtimePositionsOptions, UseRealtimePositionsReturn };