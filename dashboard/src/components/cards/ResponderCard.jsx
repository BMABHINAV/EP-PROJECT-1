import { useState } from 'react'
import { HeartPulse, Droplets, Thermometer, Wind, Battery, Signal, Clock } from 'lucide-react'
import useStore from '../../store/useStore'

const RISK = {
  normal:   { color:'#22C55E', label:'SAFE',     bg:'rgba(34,197,94,0.15)',   border:'rgba(34,197,94,0.35)'   },
  caution:  { color:'#F59E0B', label:'CAUTION',  bg:'rgba(245,158,11,0.15)',  border:'rgba(245,158,11,0.35)'  },
  warning:  { color:'#F97316', label:'WARNING',  bg:'rgba(249,115,22,0.15)',  border:'rgba(249,115,22,0.35)'  },
  critical: { color:'#EF4444', label:'CRITICAL', bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.35)'   },
}

function VCell({ icon, label, val, alert, color }) {
  return (
    <div className="rounded-xl px-2.5 py-2 border transition-all"
      style={{
        background: alert ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)',
        borderColor: alert ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center gap-1 mb-0.5" style={{ color: alert ? '#EF4444' : color, opacity:0.8 }}>
        {icon}
        <span className="text-[8px] uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <div className="font-mono text-[12px] font-bold" style={{ color: alert ? '#EF4444' : '#F8FAFC' }}>
        {val}
      </div>
    </div>
  )
}

export default function ResponderCard({ responder }) {
  const { liveVitals, liveGas, liveRRI, setSelectedResponder } = useStore()
  const [hovered, setHovered] = useState(false)

  const badge   = responder.badge_id
  const vitals  = liveVitals[badge] || {}
  const gas     = liveGas[badge]    || {}
  const rriData = liveRRI[badge]    || {}

  const rri       = rriData.rri        ?? 0
  const riskLevel = rriData.risk_level ?? 'normal'
  const heartRate = vitals.heart_rate  ?? null
  const spo2      = vitals.spo2        ?? null
  const bodyTemp  = vitals.body_temp_c ?? null
  const co        = gas.co_ppm         ?? null
  const lastSeen  = rriData.ts ? new Date(rriData.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '--:--'
  const rriPct    = Math.min(rri * 100, 100).toFixed(0)
  const s         = RISK[riskLevel] || RISK.normal

  const fmt = (v, d=0) => v!=null ? Number(v).toFixed(d) : '--'
  const alertHR   = heartRate!=null && heartRate>110
  const alertSpo2 = spo2!=null && spo2<92
  const alertTemp = bodyTemp!=null && bodyTemp>38.5
  const alertCO   = co!=null && co>25
  const isCrit    = riskLevel==='critical'

  return (
    <div
      onClick={() => setSelectedResponder(responder.id)}
      id={`responder-card-${badge}`}
      role="button" tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative group cursor-pointer overflow-hidden rounded-2xl transition-all duration-200 focus:outline-none"
      style={{
        background: 'rgba(10, 18, 34, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered ? `1px solid ${s.color}60` : '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: hovered
          ? `0 12px 40px rgba(0,0,0,0.7), 0 0 20px ${s.color}30`
          : '0 8px 32px rgba(0,0,0,0.5)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        height:3,
        background:`linear-gradient(90deg,${s.color}60,${s.color},${s.color}60)`,
        boxShadow:`0 0 8px ${s.color}`,
        animation: isCrit ? 'blink 1s ease infinite' : undefined,
      }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
              style={{ background:`linear-gradient(135deg,${s.color}70,${s.color})`, boxShadow:`0 0 10px ${s.color}50` }}>
              {responder.name.charAt(0)}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-[#060C1A]"
                style={{ background:s.color, boxShadow:`0 0 6px ${s.color}`, animation:'blink 2s ease infinite' }} />
            </div>
            <div>
              <div className="text-white text-[12px] font-bold leading-tight">{responder.name}</div>
              <div className="text-slate-400 text-[9px] mt-0.5">
                <span className="font-mono">{responder.badge_id}</span>{' · '}{responder.role}
              </div>
            </div>
          </div>
          <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
            {s.label}
          </span>
        </div>

        {/* RRI Bar */}
        <div className="mb-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Rescue Risk Index</span>
            <span className="font-mono text-[11px] font-bold" style={{ color:s.color, textShadow:`0 0 6px ${s.color}60` }}>{rriPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${rriPct}%`, background:`linear-gradient(90deg,${s.color}80,${s.color})`, boxShadow:`0 0 8px ${s.color}` }} />
          </div>
        </div>

        {/* Vitals */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <VCell icon={<HeartPulse size={10}/>} label="HR"   val={`${fmt(heartRate)} bpm`} alert={alertHR}   color="#F43F5E" />
          <VCell icon={<Droplets    size={10}/>} label="SpO₂" val={`${fmt(spo2,1)}%`}      alert={alertSpo2}  color="#06B6D4" />
          <VCell icon={<Thermometer size={10}/>} label="Temp" val={`${fmt(bodyTemp,1)}°C`}  alert={alertTemp}  color="#FB923C" />
          <VCell icon={<Wind        size={10}/>} label="CO"   val={`${fmt(co,1)} ppm`}      alert={alertCO}    color="#A78BFA" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Battery size={9} className="text-slate-500" />
              <span className="font-mono text-[9px] text-slate-400">72%</span>
            </div>
            <div className="flex items-center gap-1">
              <Signal size={9} className="text-slate-500" />
              <span className="font-mono text-[9px] text-slate-400">95%</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={9} className="text-slate-500" />
            <span className="font-mono text-[9px] text-slate-400">{lastSeen}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
