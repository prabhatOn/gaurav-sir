"use client"

import React, { useMemo, useState } from 'react'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'

interface PayoffData {
  spot: number
  pnl: number
  t0?: number
}

interface Metrics {
  currentSpot?: number
  pnl?: number
  margin?: string | number
  maxProfit?: number
  maxLoss?: number
  breakeven?: string | number
  riskReward?: string | number
  daysLeft?: number
}

interface Props {
  data: PayoffData[]
  metrics?: Metrics
  currentSpot?: number
}

function formatCurrency(v: number | string | undefined | null) {
  if (v == null) return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n.toFixed(0)}`
}

export function OiPulsePayoffChart({ data, metrics = {}, currentSpot }: Props) {
  const [showT0, setShowT0] = useState(true)
  const [showPnl, setShowPnl] = useState(true)

  const transformed = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    return data.map((d) => ({
      spot: d.spot,
      pnl: d.pnl,
      t0: d.t0 ?? null,
      profit: d.pnl > 0 ? d.pnl : 0,
      loss: d.pnl < 0 ? d.pnl : 0,
    }))
  }, [data])

  const finalYMin = useMemo(() => {
    if (!transformed.length) return -100
    const min = Math.min(...transformed.map((d) => d.pnl))
    return Math.floor(Math.min(min, 0) * 1.25)
  }, [transformed])

  const finalYMax = useMemo(() => {
    if (!transformed.length) return 100
    const max = Math.max(...transformed.map((d) => d.pnl))
    return Math.ceil(Math.max(max, 0) * 1.25)
  }, [transformed])

  // annotations: peak and breakevens
  const annotations = useMemo(() => {
    if (!transformed.length) return { peak: null as PayoffData | null, breakevens: [] as number[] }
    let peak = transformed[0]
    for (const d of transformed) if (d.pnl > peak.pnl) peak = d
    const breakevens: number[] = []
    for (let i = 0; i < transformed.length - 1; i++) {
      const a = transformed[i]
      const b = transformed[i + 1]
      if ((a.pnl <= 0 && b.pnl >= 0) || (a.pnl >= 0 && b.pnl <= 0)) {
        const denom = b.pnl - a.pnl
        if (denom === 0) breakevens.push(a.spot)
        else {
          const t = -a.pnl / denom
          const x = a.spot + t * (b.spot - a.spot)
          breakevens.push(Number(x.toFixed(2)))
        }
      }
    }
    return { peak, breakevens }
  }, [transformed])

  const currentSpotValue = currentSpot ?? metrics.currentSpot ?? (transformed.length ? transformed[Math.floor(transformed.length / 2)].spot : 0)
  const currentSpotData = transformed.find((d) => Math.abs(d.spot - currentSpotValue) < 0.0001) || transformed[Math.floor(transformed.length / 2)]

  function exportCsv() {
    const rows = ['spot,pnl,t0']
    transformed.forEach((r) => rows.push(`${r.spot},${r.pnl},${r.t0 ?? ''}`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payoff.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700 w-72">
          <div className="text-xs text-gray-500">P&L:</div>
          <div className={`font-bold ${((metrics.pnl ?? 0) as number) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(metrics.pnl)}</div>

          <div className="text-xs text-gray-500">Max Profit:</div>
          <div className="font-bold text-green-600">{formatCurrency(metrics.maxProfit)}</div>

          <div className="text-xs text-gray-500">Max Loss:</div>
          <div className="font-bold text-red-600">{formatCurrency(metrics.maxLoss)}</div>

          <div className="text-xs text-gray-500">Breakeven:</div>
          <div className="font-bold text-gray-700">{metrics.breakeven ?? '-'}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-2">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={transformed} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <pattern id="hatchLoss" patternUnits="userSpaceOnUse" width="8" height="8">
                <rect width="8" height="8" fill="#ef4444" fillOpacity={0.04} />
                <path d="M0 0 L0 8" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.18" />
                <path d="M4 0 L4 8" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.08" />
              </pattern>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="spot" tick={{ fontSize: 11 }} stroke="#6b7280" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
              domain={[finalYMin, finalYMax]}
              tickFormatter={(value) => {
                if (Number.isNaN(Number(value))) return String(value)
                if (Math.abs(Number(value)) >= 1000) return `₹${(Number(value) / 1000).toFixed(1)}k`
                return `₹${Number(value).toFixed(0)}`
              }}
            />

            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
              formatter={(value, name) => {
                const numValue = Number(value)
                return [`₹${numValue.toFixed(2)}`, name === 'pnl' ? 'P&L' : name === 't0' ? 'T+0' : name]
              }}
              labelFormatter={(label) => `Spot: ₹${label}`}
            />

            <ReferenceLine x={currentSpotValue} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: `₹${currentSpotValue}`, position: 'top', fill: '#1f2937', fontSize: 11 }} />

            {currentSpotData && (
              <ReferenceDot x={currentSpotValue} y={currentSpotData.pnl} r={4} fill="#2563eb" stroke="#2563eb" label={{ value: `₹${Number(currentSpotData.pnl).toFixed(2)}`, position: 'top', fill: '#2563eb', fontSize: 10 }} />
            )}

            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />

            <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={0} fill="url(#colorProfit)" isAnimationActive={false} baseValue={0} />
            <Area type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={0} fill="url(#hatchLoss)" isAnimationActive={false} baseValue={0} />

            {showPnl && <Line type="monotone" dataKey="pnl" stroke="#1f2937" strokeWidth={2} dot={false} name="P&L" />}
            {showT0 && <Line type="monotone" dataKey="t0" stroke="#06b6d4" strokeWidth={2} dot={false} name="T+0" strokeDasharray="4 6" />}

            {annotations.breakevens.map((b, i) => (
              <ReferenceLine key={`be-${i}`} x={b} stroke="#374151" strokeDasharray="3 3" label={{ value: `BE ${b}`, position: 'bottom', fill: '#374151', fontSize: 10 }} />
            ))}

            {annotations.peak && (
              <ReferenceDot x={annotations.peak.spot} y={annotations.peak.pnl} r={5} fill="#16a34a" stroke="#16a34a" label={{ value: `Peak: ₹${Number(annotations.peak.pnl).toFixed(0)}`, position: 'top', fill: '#16a34a', fontSize: 11 }} />
            )}

          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={showPnl} onChange={() => setShowPnl((s) => !s)} className="w-4 h-4" />
            <span>P&L</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={showT0} onChange={() => setShowT0((s) => !s)} className="w-4 h-4" />
            <span>T+0</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="p-1 hover:bg-gray-200 rounded text-gray-600 text-xs">Export CSV</button>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
          <span>P&L</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-500" />
          <span>T+0</span>
        </div>
      </div>
    </div>
  )
}
