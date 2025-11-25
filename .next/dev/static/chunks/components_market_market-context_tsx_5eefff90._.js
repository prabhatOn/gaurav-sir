(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/market/market-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MarketProvider",
    ()=>MarketProvider,
    "useMarket",
    ()=>useMarket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
const MarketContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const SOCKET_URL = ("TURBOPACK compile-time value", "http://localhost:5000") || 'http://localhost:5000';
const API_BASE = ("TURBOPACK compile-time value", "http://localhost:5000") || 'http://localhost:5000';
// Default tokens will be fetched dynamically from API when needed
// These are just placeholder keys - actual tokens come from database when symbol is selected
const DEFAULT_TOKENS = [];
function MarketProvider({ children }) {
    _s();
    const [store, setStore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const socketRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const pendingTokensRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const tokenMetaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const defaultsRegisteredRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const pollingIntervalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isPollingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    // Use refs to avoid dependency issues
    const storeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(store);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MarketProvider.useEffect": ()=>{
            storeRef.current = store;
        }
    }["MarketProvider.useEffect"], [
        store
    ]);
    const emitPendingSubscriptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[emitPendingSubscriptions]": ()=>{
            if (!socketRef.current || !socketRef.current.connected || pendingTokensRef.current.size === 0) return;
            const payload = Array.from(pendingTokensRef.current).map({
                "MarketProvider.useCallback[emitPendingSubscriptions].payload": (key)=>{
                    const [exchange, token] = key.split(':');
                    const meta = tokenMetaRef.current.get(key);
                    const symbol = meta?.symbol;
                    return {
                        exchange,
                        token,
                        symbol,
                        symbolName: symbol
                    };
                }
            }["MarketProvider.useCallback[emitPendingSubscriptions].payload"]);
            try {
                socketRef.current.emit('subscribePositions', {
                    brokerId: 'market',
                    tokens: payload,
                    updateInterval: 5
                });
                console.log('Market: emitted subscribePositions for tokens', payload);
            } catch (e) {
                console.error('Market: failed to emit subscribePositions', e);
            }
        }
    }["MarketProvider.useCallback[emitPendingSubscriptions]"], []);
    const syncFullQuotes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[syncFullQuotes]": async (tokenList)=>{
            if (!tokenList || tokenList.length === 0) return;
            // Deduplicate tokens per exchange
            const dedupMap = new Map();
            tokenList.forEach({
                "MarketProvider.useCallback[syncFullQuotes]": (item)=>{
                    if (!item?.token) return;
                    const exchange = (item.exchange || 'NSE').toUpperCase();
                    const key = `${exchange}:${item.token}`;
                    dedupMap.set(key, {
                        exchange,
                        token: String(item.token)
                    });
                }
            }["MarketProvider.useCallback[syncFullQuotes]"]);
            if (dedupMap.size === 0) return;
            try {
                const response = await fetch(`${API_BASE}/api/quotes/full`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tokens: Array.from(dedupMap.values())
                    })
                });
                const json = await response.json();
                if (!json?.success || !Array.isArray(json.data)) return;
                setStore({
                    "MarketProvider.useCallback[syncFullQuotes]": (prev)=>{
                        const copy = {
                            ...prev
                        };
                        json.data.forEach({
                            "MarketProvider.useCallback[syncFullQuotes]": (quote)=>{
                                if (!quote) return;
                                const exchange = (quote.exchange || 'NSE').toUpperCase();
                                const token = quote.token ? String(quote.token) : undefined;
                                const keyId = token ? `${exchange}:${token}` : undefined;
                                const meta = keyId ? tokenMetaRef.current.get(keyId) : undefined;
                                const symbolKey = meta?.symbol || quote.symbol || (token ? `Token_${token}` : undefined);
                                if (!symbolKey) return;
                                console.log(`[MarketContext] 📊 Full quote for key="${symbolKey}" token=${token}: LTP=${quote.ltp}, low=${quote.low}, high=${quote.high}`);
                                copy[symbolKey] = {
                                    ...copy[symbolKey] || {},
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
                                    lot_size: copy[symbolKey]?.lot_size
                                };
                            }
                        }["MarketProvider.useCallback[syncFullQuotes]"]);
                        console.log('[MarketContext] 📊 After full quote sync, total keys:', Object.keys(copy).length);
                        return copy;
                    }
                }["MarketProvider.useCallback[syncFullQuotes]"]);
            } catch (error) {
                console.error('Market: unable to sync full quotes', error);
            }
        }
    }["MarketProvider.useCallback[syncFullQuotes]"], []);
    // Poll for quotes at regular intervals to ensure real-time updates
    const startPolling = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[startPolling]": ()=>{
            // Avoid starting multiple polling loops
            if (isPollingRef.current) return;
            isPollingRef.current = true;
            // Clear any existing polling
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            // Poll every 2 seconds for live data (reduced frequency to avoid overload)
            pollingIntervalRef.current = setInterval({
                "MarketProvider.useCallback[startPolling]": ()=>{
                    if (pendingTokensRef.current.size === 0) return;
                    const tokenList = Array.from(pendingTokensRef.current).map({
                        "MarketProvider.useCallback[startPolling].tokenList": (key)=>{
                            const [exchange, token] = key.split(':');
                            return {
                                exchange,
                                token
                            };
                        }
                    }["MarketProvider.useCallback[startPolling].tokenList"]);
                    // Only sync quotes, don't re-emit subscriptions every interval
                    syncFullQuotes(tokenList);
                }
            }["MarketProvider.useCallback[startPolling]"], 2000); // Poll every 2 seconds
            console.log('[MarketContext] 🔄 Started polling for real-time updates');
        }
    }["MarketProvider.useCallback[startPolling]"], [
        syncFullQuotes
    ]);
    const stopPolling = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[stopPolling]": ()=>{
            isPollingRef.current = false;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                console.log('[MarketContext] ⏹️ Stopped polling');
            }
        }
    }["MarketProvider.useCallback[stopPolling]"], []);
    const subscribeTokens = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[subscribeTokens]": (tokens)=>{
            try {
                if (!Array.isArray(tokens) || tokens.length === 0) return;
                console.log('[MarketContext] 📝 subscribeTokens called with:', tokens);
                const formatted = tokens.map({
                    "MarketProvider.useCallback[subscribeTokens].formatted": (token)=>{
                        if (token == null) return null;
                        if (typeof token === 'object' && 'token' in token) {
                            return {
                                token: String(token.token),
                                exchange: (token.exchange || 'NSE').toUpperCase(),
                                symbol: token.symbol
                            };
                        }
                        return {
                            token: String(token),
                            exchange: 'NSE'
                        };
                    }
                }["MarketProvider.useCallback[subscribeTokens].formatted"]).filter(Boolean);
                if (formatted.length === 0) return;
                console.log('[MarketContext] 📝 Formatted tokens for subscription:', formatted);
                formatted.forEach({
                    "MarketProvider.useCallback[subscribeTokens]": ({ token, exchange, symbol })=>{
                        const key = `${exchange}:${token}`;
                        pendingTokensRef.current.add(key);
                        tokenMetaRef.current.set(key, {
                            exchange,
                            symbol
                        });
                        console.log(`[MarketContext] Added to pending: ${key} -> ${symbol}`);
                    }
                }["MarketProvider.useCallback[subscribeTokens]"]);
                emitPendingSubscriptions();
                syncFullQuotes(formatted.map({
                    "MarketProvider.useCallback[subscribeTokens]": ({ exchange, token })=>({
                            exchange,
                            token
                        })
                }["MarketProvider.useCallback[subscribeTokens]"]));
                // Start polling for continuous updates (only starts once)
                startPolling();
            } catch (error) {
                console.error('Market: failed to subscribe tokens', error);
            }
        }
    }["MarketProvider.useCallback[subscribeTokens]"], []) // Empty deps - use refs for any mutable state
    ;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MarketProvider.useEffect": ()=>{
            // Connect to backend Socket.IO server
            try {
                const socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])(SOCKET_URL, {
                    transports: [
                        'websocket',
                        'polling'
                    ],
                    autoConnect: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 2000
                });
                socketRef.current = socket;
                socket.on('connect', {
                    "MarketProvider.useEffect": ()=>{
                        setConnected(true);
                        console.log('Market: connected to position WebSocket server');
                        emitPendingSubscriptions();
                    }
                }["MarketProvider.useEffect"]);
                socket.on('disconnect', {
                    "MarketProvider.useEffect": (reason)=>{
                        setConnected(false);
                        console.log('Market: disconnected from position WebSocket server', reason);
                    }
                }["MarketProvider.useEffect"]);
                socket.on('positionUpdate', {
                    "MarketProvider.useEffect": (payload)=>{
                        try {
                            const positions = payload?.positions || [];
                            if (positions.length === 0) return;
                            // Debug: show incoming positions for troubleshooting
                            console.log('[MarketContext] 📡 positionUpdate received:', {
                                positionsCount: positions.length,
                                sample: positions.slice(0, 2)
                            });
                            // positions are expected to be parsed market ticks forwarded from backend
                            // Example item: { symbol: 'NIFTY 50', token: 26000, ltp: 21123.45, timestamp: '...' }
                            setStore({
                                "MarketProvider.useEffect": (prev)=>{
                                    let hasChanges = false;
                                    const copy = {
                                        ...prev
                                    };
                                    for (const p of positions){
                                        const key = (p.symbol || p.symbolName || p.name || `Token_${p.token || ''}`).toString();
                                        const existing = copy[key];
                                        const newLtp = p.ltp != null ? Number(p.ltp) : existing?.ltp;
                                        // Only update if there's actually new data
                                        if (newLtp !== existing?.ltp || !existing) {
                                            hasChanges = true;
                                            copy[key] = {
                                                ...existing || {},
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
                                            };
                                        }
                                    }
                                    // Only return new object if there are actual changes
                                    return hasChanges ? copy : prev;
                                }
                            }["MarketProvider.useEffect"]);
                        } catch (e) {
                            console.error('Market: failed to handle positionUpdate', e);
                        }
                    }
                }["MarketProvider.useEffect"]);
                socket.on('initialPositions', {
                    "MarketProvider.useEffect": (payload)=>{
                        try {
                            const positions = payload?.positions || [];
                            const map = {};
                            for (const p of positions){
                                const key = (p.symbol || p.symbolName || p.name || `Token_${p.token || ''}`).toString();
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
                                    volume: p.volume
                                };
                            }
                            setStore({
                                "MarketProvider.useEffect": (prev)=>({
                                        ...prev,
                                        ...map
                                    })
                            }["MarketProvider.useEffect"]);
                            // Debug: load initial map into window variable for inspection
                            try {
                                window._marketSymbolsDebug = map;
                            } catch (e) {}
                        } catch (e) {
                            console.error('Market: failed to handle initialPositions', e);
                        }
                    }
                }["MarketProvider.useEffect"]);
                socket.on('connect_error', {
                    "MarketProvider.useEffect": (err)=>{
                        console.error('Market: socket connect_error', err);
                        setConnected(false);
                    }
                }["MarketProvider.useEffect"]);
                return ({
                    "MarketProvider.useEffect": ()=>{
                        try {
                            socket.off('positionUpdate');
                            socket.off('initialPositions');
                            socket.disconnect();
                            // Stop polling on cleanup
                            if (pollingIntervalRef.current) {
                                clearInterval(pollingIntervalRef.current);
                                pollingIntervalRef.current = null;
                            }
                        } catch (e) {}
                    }
                })["MarketProvider.useEffect"];
            } catch (e) {
                console.error('Market: failed to initialize socket', e);
            }
        }
    }["MarketProvider.useEffect"], []);
    // Register defaults once after mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MarketProvider.useEffect": ()=>{
            if (!defaultsRegisteredRef.current && DEFAULT_TOKENS.length > 0) {
                defaultsRegisteredRef.current = true;
                subscribeTokens(DEFAULT_TOKENS);
            }
        }
    }["MarketProvider.useEffect"], []); // Run only once on mount
    // Cleanup polling on unmount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MarketProvider.useEffect": ()=>{
            return ({
                "MarketProvider.useEffect": ()=>{
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                }
            })["MarketProvider.useEffect"];
        }
    }["MarketProvider.useEffect"], []);
    // Use a stable reference for subscribeTokens
    const subscribeTokensRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(subscribeTokens);
    subscribeTokensRef.current = subscribeTokens;
    const stableSubscribeTokens = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MarketProvider.useCallback[stableSubscribeTokens]": (tokens)=>{
            subscribeTokensRef.current(tokens);
        }
    }["MarketProvider.useCallback[stableSubscribeTokens]"], []);
    const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "MarketProvider.useMemo[state]": ()=>({
                symbols: store,
                connected,
                subscribeTokens: stableSubscribeTokens
            })
    }["MarketProvider.useMemo[state]"], [
        store,
        connected,
        stableSubscribeTokens
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MarketContext.Provider, {
        value: state,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/market/market-context.tsx",
        lineNumber: 374,
        columnNumber: 10
    }, this);
}
_s(MarketProvider, "ASkZjx+uULnCXpHxtCMxq89NmeE=");
_c = MarketProvider;
function useMarket() {
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(MarketContext);
    if (!ctx) throw new Error('useMarket must be used within MarketProvider');
    return ctx;
}
_s1(useMarket, "/dMy7t63NXD4eYACoT93CePwGrg=");
var _c;
__turbopack_context__.k.register(_c, "MarketProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=components_market_market-context_tsx_5eefff90._.js.map