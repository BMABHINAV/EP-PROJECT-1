import { useState, useEffect, useCallback } from 'react'
import { Brain, RefreshCw, AlertTriangle, ShieldCheck, Activity, Zap } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts'
import useStore from '../store/useStore'
import { api } from '../services/api'

const RISK_META = {
  normal:   { color: '#22c55e', label: 'SAFE',     bg: 'bg-safe/10',  border: 'border-safe/25'  },
  caution:  { color: '#f59e0b', label: 'CAUTION',  bg: 'bg-warn/10',  border: 'border-warn/25'  },
  warning:  { color: '#f97316', label: 'WARNING',  bg: 'bg-warn/10',  border: 'border-warn/25'  },
  critical: { color: '#ef4444', label: 'CRITICAL', bg: 'bg-crit/10',  border: 'border-crit/25'  },
}

const TT_STYLE = { backgroundColor:'#0c1428', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, fontSize:11 }

function RRIGauge({ value = 0, risk = 'normal' }) {
  const color = RISK_META[risk]?.color || '#22c55e'
  const pct   = Math.round(value * 100)
  const data  = [{ value: pct, fill: color }]
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 90, height: 90 }}>
        <RadialBarChart
          width={90} height={90}
          cx={45} cy={45}
          innerRadius={28} outerRadius={42}
          startAngle={210} endAngle={-30}
          data={data} barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#1e293b' }} dataKey="value" angleAxisId={0} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

function PredictionCard({ responder, prediction, history, loading }) {
  const risk = prediction?.risk_level || 'normal'
  const { color, label, bg, border } = RISK_META[risk] || RISK_META.normal
  const rri = prediction?.rri ?? 0
  const fatigue = prediction?.fatigue_probability ?? null

  return (
    <div className={`rounded-xl bg-dash-card border ${border} p-4 flex flex-col gap-3 hover:shadow-card transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand/80 to-blue-600 flex items-center justify-center text-white text-[11px] font-bold">
            {responder.name.charAt(0)}
          </div>
          <div>
            <div className="text-white text-[12px] font-semibold">{responder.name}</div>
            <div className="text-slate-500 text-[9px]">{responder.badge_id}</div>
          </div>
        </div>
        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${bg} ${border}`} style={{ color }}>
          {label}
        </span>
      </div>

      {/* Gauge + stats */}
      <div className="flex items-center gap-4">
        {loading ? (
          <div className="w-[90px] h-[90px] flex items-center justify-center text-slate-600">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : (
          <RRIGauge value={rri} risk={risk} />
        )}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">Rescue Risk Index</span>
            <span className="font-mono text-[12px] font-bold" style={{ color }}>{(rri * 100).toFixed(1)}%</span>
          </div>
          {fatigue != null && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Fatigue Prob.</span>
              <span className={`font-mono text-[12px] font-bold ${fatigue > 0.6 ? 'text-crit' : fatigue > 0.35 ? 'text-warn' : 'text-safe'}`}>
                {(fatigue * 100).toFixed(1)}%
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">Inference</span>
            <span className="font-mono text-[10px] text-slate-400">
              {prediction?.inference_time_ms ? `${prediction.inference_time_ms.toFixed(1)} ms` : 'Rule-based'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">Updated</span>
            <span className="font-mono text-[10px] text-slate-500">
              {prediction?.time ? new Date(prediction.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Mini RRI trend */}
      {history.length > 1 && (
        <div style={{ height: 60 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top:0, right:0, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={`rriGrad-${responder.badge_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Tooltip contentStyle={TT_STYLE} />
              <Area type="monotone" dataKey="rri" stroke={color} fill={`url(#rriGrad-${responder.badge_id})`}
                strokeWidth={1.5} dot={false} connectNulls name="RRI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function AIPredictionsPage() {
  const { responders, liveRRI } = useStore()
  const [predictions, setPredictions] = useState({})
  const [histories, setHistories]     = useState({})
  const [loading, setLoading]         = useState({})

  const fetchPredictions = useCallback(async () => {
    await Promise.all(responders.map(async (r) => {
      setLoading(prev => ({ ...prev, [r.badge_id]: true }))
      try {
        const [latestRes, histRes] = await Promise.allSettled([
          api.get(`/api/v1/predictions/${r.badge_id}/latest`),
          api.get(`/api/v1/predictions/${r.badge_id}/history?minutes=30`),
        ])

        if (latestRes.status === 'fulfilled' && !latestRes.value.data.message && !latestRes.value.data.error) {
          setPredictions(prev => ({ ...prev, [r.badge_id]: latestRes.value.data }))
        } else {
          // Fall back to live liveRRI store data
          const rriData = liveRRI[r.badge_id]
          if (rriData) {
            setPredictions(prev => ({
              ...prev,
              [r.badge_id]: {
                rri: rriData.rri,
                risk_level: rriData.risk_level,
                fatigue_probability: null,
                inference_time_ms: null,
                time: rriData.ts,
              }
            }))
          }
        }

        if (histRes.status === 'fulfilled' && histRes.value.data.data) {
          setHistories(prev => ({
            ...prev,
            [r.badge_id]: histRes.value.data.data.map(p => ({
              time: new Date(p.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
              rri: p.rri * 100,
            }))
          }))
        }
      } catch {
        // Use live store RRI as fallback
        const rriData = liveRRI[r.badge_id]
        if (rriData) {
          setPredictions(prev => ({
            ...prev,
            [r.badge_id]: {
              rri: rriData.rri,
              risk_level: rriData.risk_level,
              fatigue_probability: null,
              time: rriData.ts,
            }
          }))
        }
      } finally {
        setLoading(prev => ({ ...prev, [r.badge_id]: false }))
      }
    }))
  }, [responders, liveRRI])

  // Fetch on mount and every 5s
  useEffect(() => {
    fetchPredictions()
    const iv = setInterval(fetchPredictions, 5000)
    return () => clearInterval(iv)
  }, [fetchPredictions])

  const critCount = Object.values(predictions).filter(p => p?.risk_level === 'critical').length
  const warnCount = Object.values(predictions).filter(p => p?.risk_level === 'warning' || p?.risk_level === 'caution').length
  const avgRRI    = responders.length
    ? Object.values(predictions).reduce((s, p) => s + (p?.rri ?? 0), 0) / responders.length
    : 0

  return (
    <div className="flex flex-col gap-5 p-5 min-h-full bg-dash-bg">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Brain size={18} className="text-mis" />
            AI Predictions
          </h1>
          <p className="text-slate-500 text-[10px] mt-0.5">
            Live Rescue Risk Index &amp; fatigue forecasting via Neural Network
          </p>
        </div>
        <button
          onClick={fetchPredictions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dash-card border border-dash-border2 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <RefreshCw size={12} />Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon:<Activity size={16} className="text-brand"/>,        label:'Avg RRI', value:`${(avgRRI*100).toFixed(1)}%`, color:'text-brand' },
          { icon:<AlertTriangle size={16} className="text-crit"/>,   label:'Critical', value:critCount, color:'text-crit' },
          { icon:<AlertTriangle size={16} className="text-warn"/>,   label:'Warning',  value:warnCount, color:'text-warn' },
          { icon:<ShieldCheck size={16} className="text-safe"/>,     label:'Safe', value:responders.length - critCount - warnCount, color:'text-safe' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-dash-card border border-dash-border2 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">{icon}</div>
            <div>
              <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
              <div className="text-slate-500 text-[10px]">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Model status banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-mis/5 border border-mis/20">
        <Zap size={14} className="text-mis shrink-0" />
        <div className="text-[11px] text-slate-300 flex-1">
          <span className="font-semibold text-mis">Neural Network Active</span>
          {' · '}Dual-head model (RRI regression + 4-class risk) — trained on 50k physiological samples.
          {' '}Run <span className="font-mono text-slate-400">ml/training/train_rri_model.py</span> to retrain.
        </div>
      </div>

      {/* Prediction cards grid */}
      {responders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          No responders connected — start the simulator.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {responders.map(r => (
            <PredictionCard
              key={r.id}
              responder={r}
              prediction={predictions[r.badge_id]}
              history={histories[r.badge_id] || []}
              loading={loading[r.badge_id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
