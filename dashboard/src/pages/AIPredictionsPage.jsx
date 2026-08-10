import { useState, useEffect, useCallback } from 'react'
import { Brain, RefreshCw, AlertTriangle, ShieldCheck, Activity, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useStore from '../store/useStore'
import { api } from '../services/api'
import AnimatedGauge from '../components/ui/AnimatedGauge'
import CountUp from '../components/ui/CountUp'

const RISK_META = {
  normal:   { color:'#22C55E', label:'SAFE',     bg:'rgba(34,197,94,0.15)',   border:'rgba(34,197,94,0.35)'   },
  caution:  { color:'#F59E0B', label:'CAUTION',  bg:'rgba(245,158,11,0.15)',  border:'rgba(245,158,11,0.35)'  },
  warning:  { color:'#F97316', label:'WARNING',  bg:'rgba(249,115,22,0.15)',  border:'rgba(249,115,22,0.35)'  },
  critical: { color:'#EF4444', label:'CRITICAL', bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.35)'   },
}

const TT = {
  backgroundColor: 'rgba(6, 12, 24, 0.92)',
  border: '1px solid rgba(59, 130, 246, 0.35)',
  borderRadius: 10,
  fontSize: 11,
  backdropFilter: 'blur(12px)',
}

function PredictionCard({ responder, prediction, history, loading, index }) {
  const risk = prediction?.risk_level || 'normal'
  const { color, label, bg, border } = RISK_META[risk] || RISK_META.normal
  const rri  = prediction?.rri ?? 0
  const fatigue = prediction?.fatigue_probability ?? null
  const rriPct  = Math.round(rri * 100)
  const action  = risk==='critical' ? 'Evacuate Immediately' : risk==='warning' ? 'Supervisor Alert' : risk==='caution' ? 'Monitor Closely' : 'Continue Mission'
  const fatigueTrend = fatigue!=null
    ? fatigue>0.6 ? { text:'Fatigue Increasing', icon:<TrendingUp size={9}/>, color:'#EF4444' }
      : fatigue>0.35 ? { text:'Moderate Fatigue', icon:<TrendingUp size={9}/>, color:'#F59E0B' }
      : { text:'Fatigue Stable', icon:<TrendingDown size={9}/>, color:'#22C55E' }
    : null

  return (
    <div
      className="rounded-2xl flex flex-col gap-3 p-4 transition-all duration-250 hover:-translate-y-0.5 animate-fade-scale"
      style={{
        background: 'rgba(10, 18, 34, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}20`,
        animationDelay:`${index*60}ms`, animationFillMode:'both',
      }}
    >
      {/* Top bar */}
      <div style={{ height:2.5, background:`linear-gradient(90deg,${color}50,${color},${color}50)`, borderRadius:2, boxShadow:`0 0 8px ${color}` }} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
            style={{ background:`linear-gradient(135deg,${color}60,${color})`, boxShadow:`0 0 10px ${color}50` }}>
            {responder.name.charAt(0)}
          </div>
          <div>
            <div className="text-white text-[12px] font-bold">{responder.name}</div>
            <div className="font-mono text-[9px] text-slate-400">{responder.badge_id}</div>
          </div>
        </div>
        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background:bg, color, border:`1px solid ${border}` }}>
          {label}
        </span>
      </div>

      {/* Gauge */}
      {loading ? (
        <div className="flex items-center justify-center py-4"><RefreshCw size={20} className="animate-spin text-slate-500" /></div>
      ) : (
        <div className="flex items-center gap-4">
          <AnimatedGauge value={rriPct} color={color} size={110} sublabel="RRI" />
          <div className="flex-1 flex flex-col gap-2">
            {fatigueTrend && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ background:`${fatigueTrend.color}15`, border:`1px solid ${fatigueTrend.color}30` }}>
                <span style={{ color:fatigueTrend.color }}>{fatigueTrend.icon}</span>
                <span className="text-[9px] font-semibold" style={{ color:fatigueTrend.color }}>{fatigueTrend.text}</span>
              </div>
            )}
            {fatigue!=null && (
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-slate-400">Fatigue Prob.</span>
                  <span className="font-mono font-bold" style={{ color:fatigue>0.6?'#EF4444':fatigue>0.35?'#F59E0B':'#22C55E' }}>
                    {(fatigue*100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width:`${fatigue*100}%`, background:fatigue>0.6?'#EF4444':fatigue>0.35?'#F59E0B':'#22C55E' }} />
                </div>
              </div>
            )}
            <div className="px-2.5 py-1.5 rounded-lg" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[8px] text-slate-400 uppercase tracking-widest mb-0.5">Recommended</div>
              <div className="text-[10px] font-semibold" style={{ color }}>{action}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sparkline */}
      {history && history.length>1 && (
        <div style={{ height:55 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50}>
            <AreaChart data={history} margin={{ top:2,right:0,bottom:0,left:0 }}>
              <defs>
                <linearGradient id={`rriG-${responder.badge_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.00} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide /><YAxis hide domain={[0,100]} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="rri" stroke={color} fill={`url(#rriG-${responder.badge_id})`} strokeWidth={1.5} dot={false} connectNulls name="RRI %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <span>Inference: {prediction?.inference_time_ms ? `${prediction.inference_time_ms.toFixed(1)}ms` : 'Rule-based'}</span>
        <span>{prediction?.time ? new Date(prediction.time).toLocaleTimeString([],{ hour:'2-digit',minute:'2-digit' }) : 'Live'}</span>
      </div>
    </div>
  )
}

export default function AIPredictionsPage() {
  const { responders, liveRRI, history } = useStore()
  const [predictions, setPredictions] = useState({})
  const [histories, setHistories]     = useState({})
  const [loading, setLoading]         = useState({})
  const [spinning, setSpinning]       = useState(false)

  const fetchPredictions = useCallback(async () => {
    setSpinning(true)
    await Promise.all(responders.map(async r => {
      setLoading(prev => ({ ...prev, [r.badge_id]:true }))
      try {
        const [latestRes, histRes] = await Promise.allSettled([
          api.get(`/api/v1/predictions/${r.badge_id}/latest`),
          api.get(`/api/v1/predictions/${r.badge_id}/history?minutes=30`),
        ])
        if (latestRes.status==='fulfilled' && latestRes.value.data && !latestRes.value.data.message && !latestRes.value.data.error) {
          setPredictions(prev => ({ ...prev, [r.badge_id]:latestRes.value.data }))
        } else {
          const d = liveRRI[r.badge_id]
          if (d) setPredictions(prev => ({ ...prev, [r.badge_id]:{ rri:d.rri, risk_level:d.risk_level, time:d.ts } }))
        }
        if (histRes.status==='fulfilled' && histRes.value.data?.data?.length) {
          setHistories(prev => ({ ...prev, [r.badge_id]:histRes.value.data.data.map(p => ({
            time:new Date(p.time).toLocaleTimeString([],{ hour:'2-digit',minute:'2-digit' }),
            rri:p.rri*100,
          })) }))
        }
      } catch {
        const d = liveRRI[r.badge_id]
        if (d) setPredictions(prev => ({ ...prev, [r.badge_id]:{ rri:d.rri, risk_level:d.risk_level, time:d.ts } }))
      } finally {
        setLoading(prev => ({ ...prev, [r.badge_id]:false }))
      }
    }))
    setTimeout(() => setSpinning(false), 400)
  }, [responders])

  useEffect(() => { fetchPredictions(); const iv=setInterval(fetchPredictions,10000); return ()=>clearInterval(iv) }, [fetchPredictions])

  // Sync with live WebSocket RRI updates
  useEffect(() => {
    responders.forEach(r => {
      const d = liveRRI[r.badge_id]
      if (d) {
        setPredictions(prev => ({
          ...prev,
          [r.badge_id]: {
            rri: d.rri ?? prev[r.badge_id]?.rri ?? 0,
            risk_level: d.risk_level || prev[r.badge_id]?.risk_level || 'normal',
            time: d.ts || prev[r.badge_id]?.time,
            fatigue_probability: prev[r.badge_id]?.fatigue_probability ?? 0.15,
            inference_time_ms: prev[r.badge_id]?.inference_time_ms ?? 2.4,
          }
        }))
      }
    })
  }, [liveRRI, responders])

  const effectivePreds = responders.map(r => predictions[r.badge_id] || (liveRRI[r.badge_id] ? { rri:liveRRI[r.badge_id].rri, risk_level:liveRRI[r.badge_id].risk_level } : { rri:0.05, risk_level:'normal' }))
  const critCount = effectivePreds.filter(p => p.risk_level==='critical').length
  const warnCount = effectivePreds.filter(p => p.risk_level==='warning'||p.risk_level==='caution').length
  const avgRRI    = effectivePreds.length ? effectivePreds.reduce((s,p)=>s+(p.rri||0),0)/effectivePreds.length : 0

  return (
    <div className="flex flex-col gap-5 p-5 min-h-full animate-fade-scale" style={{ background:'transparent' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">AI INTELLIGENCE CENTER</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain size={18} className="text-mis" style={{ filter:'drop-shadow(0 0 6px #A78BFA)' }} /> AI Predictions
          </h1>
          <p className="text-slate-400 text-[10px] mt-1">Neural network RRI regression + 4-class risk classification</p>
        </div>
        <button onClick={fetchPredictions} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all btn-tactical"
          style={{ background:'rgba(10, 18, 34, 0.75)', border:'1px solid rgba(59,130,246,0.22)', color:'#94A3B8' }}>
          <RefreshCw size={12} className={spinning?'animate-spin':''} /> Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl" style={{ background:'rgba(10, 18, 34, 0.78)', border:'1px solid rgba(59,130,246,0.22)', backdropFilter:'blur(16px)' }}>
        {[
          { icon:<Activity size={16}/>,     label:'Avg RRI',  value:`${(avgRRI*100).toFixed(1)}%`, color:'#3B82F6' },
          { icon:<AlertTriangle size={16}/>, label:'Critical', value:critCount,                     color:'#EF4444' },
          { icon:<AlertTriangle size={16}/>, label:'Warning',  value:warnCount,                     color:'#F59E0B' },
          { icon:<ShieldCheck size={16}/>,   label:'Safe',     value:responders.length-critCount-warnCount, color:'#22C55E' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background:`${color}15`, border:`1px solid ${color}30`, color }}>
              {icon}
            </div>
            <div>
              <div className="font-mono text-xl font-bold" style={{ color, textShadow:`0 0 8px ${color}60` }}>
                {typeof value==='number' ? <CountUp value={value} decimals={0} /> : value}
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-widest">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* AI status */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.25)' }}>
        <Zap size={13} className="text-mis shrink-0" style={{ filter:'drop-shadow(0 0 6px #A78BFA)' }} />
        <div className="flex-1 text-[11px] text-slate-300">
          <span className="font-bold text-mis">Neural Network Active</span>{' · '}
          Dual-head model (RRI regression + 4-class risk) — trained on 50k physiological samples.{' '}
          Run <span className="font-mono text-slate-400 text-[10px]">ml/training/train_rri_model.py</span> to retrain.
        </div>
        <div className="flex items-center gap-1.5">
          {[...Array(3)].map((_,i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-mis" style={{ animation:`blink ${0.8+i*0.3}s ease infinite`, boxShadow:'0 0 6px #A78BFA' }} />
          ))}
        </div>
      </div>

      {responders.length===0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-500 text-sm">
          <Brain size={36} className="text-slate-600" />No responders connected.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {responders.map((r,i) => {
            const pred = predictions[r.badge_id] || (liveRRI[r.badge_id] ? { rri:liveRRI[r.badge_id].rri, risk_level:liveRRI[r.badge_id].risk_level } : { rri:0.05, risk_level:'normal' })
            const histData = histories[r.badge_id] || (history[r.badge_id] || []).map(d => ({ time:d.time, rri: (liveRRI[r.badge_id]?.rri || 0.05)*100 }))
            return (
              <PredictionCard key={r.id} index={i} responder={r}
                prediction={pred} history={histData} loading={loading[r.badge_id]} />
            )
          })}
        </div>
      )}
    </div>
  )
}
