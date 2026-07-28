import { HeartPulse, Droplets, Thermometer, Wind } from 'lucide-react'
import useStore from '../../store/useStore'

const RISK = {
  normal:   { bar: '#22c55e', badge: 'bg-safe/10 text-safe border-safe/25',     top: 'bg-safe',  label:'SAFE' },
  caution:  { bar: '#f59e0b', badge: 'bg-warn/10 text-warn border-warn/25',     top: 'bg-warn',  label:'CAUTION' },
  warning:  { bar: '#f97316', badge: 'bg-warn/10 text-warn border-warn/25',     top: 'bg-warn',  label:'WARNING' },
  critical: { bar: '#ef4444', badge: 'bg-crit/10 text-crit border-crit/25',     top: 'bg-crit',  label:'CRITICAL' },
}

export default function ResponderCard({ responder }) {
  const { liveVitals, liveGas, liveRRI, setSelectedResponder } = useStore()

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

  const fmt = (v, d = 0) => v != null ? Number(v).toFixed(d) : '--'
  const alertHR   = heartRate != null && heartRate > 110
  const alertSpo2 = spo2 != null && spo2 < 92
  const alertTemp = bodyTemp != null && bodyTemp > 38.5
  const alertCO   = co != null && co > 25

  return (
    <div
      onClick={() => setSelectedResponder(responder.id)}
      id={`responder-card-${badge}`}
      role="button" tabIndex={0}
      className="relative group cursor-pointer overflow-hidden rounded-xl 
                 bg-dash-card border border-dash-border2
                 hover:border-dash-border hover:shadow-card hover:-translate-y-0.5
                 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
    >
      <div className={`h-0.5 w-full ${s.top} ${riskLevel === 'critical' ? 'blink' : ''}`} />

      <div className="p-3.5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-semibold text-[13px] text-white leading-tight">{responder.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <span className="font-mono text-slate-400">{responder.badge_id}</span>
              <span className="mx-1">·</span>{responder.role}
            </div>
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${s.badge}`}>
            {s.label}
          </span>
        </div>

        {/* RRI bar */}
        <div className="mb-3.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase">Rescue Risk Index</span>
            <span className="font-mono text-[10px] font-bold" style={{ color: s.bar }}>{rriPct}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width:`${rriPct}%`, background: s.bar }} />
          </div>
        </div>

        {/* Vitals grid */}
        <div className="grid grid-cols-2 gap-2">
          <VCell icon={<HeartPulse size={10} className="text-hr"/>} label="HR"   val={`${fmt(heartRate)} bpm`} alert={alertHR} />
          <VCell icon={<Droplets size={10} className="text-spo2"/>} label="SpO2" val={`${fmt(spo2, 1)}%`}     alert={alertSpo2} />
          <VCell icon={<Thermometer size={10} className="text-temp"/>} label="Temp" val={`${fmt(bodyTemp, 1)}°C`} alert={alertTemp} />
          <VCell icon={<Wind size={10} className="text-co"/>} label="CO" val={`${fmt(co, 1)} ppm`} alert={alertCO} />
        </div>

        <div className="text-[9px] text-slate-600 text-right mt-2">Updated {lastSeen}</div>
      </div>
    </div>
  )
}

function VCell({ icon, label, val, alert }) {
  return (
    <div className={`rounded-lg px-2.5 py-1.5 border ${alert ? 'bg-crit/8 border-crit/20' : 'bg-white/[0.025] border-transparent'}`}>
      <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-0.5">
        {icon}<span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-mono text-[12px] font-semibold ${alert ? 'text-crit' : 'text-slate-200'}`}>{val}</div>
    </div>
  )
}
