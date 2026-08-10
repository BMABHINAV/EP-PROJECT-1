import { Suspense } from 'react'
import LiveMapWidget from '../components/map/LiveMapWidget'
import useStore from '../store/useStore'
import { Map } from 'lucide-react'

const RISK_COLOR = { normal:'#22C55E', caution:'#F59E0B', warning:'#F97316', critical:'#EF4444' }

export default function LiveMapPage() {
  const { responders, liveRRI, liveVitals } = useStore()
  const critCount = Object.values(liveRRI).filter(r => r.risk_level === 'critical').length
  const warnCount = Object.values(liveRRI).filter(r => r.risk_level === 'warning' || r.risk_level === 'caution').length
  const safeCount = Math.max(0, responders.length - critCount - warnCount)

  return (
    <div className="flex flex-col h-full animate-fade-scale" style={{ background:'transparent' }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{
          background: 'rgba(6, 12, 24, 0.82)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(59,130,246,0.22)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Map size={13} className="text-info" style={{ filter:'drop-shadow(0 0 5px #38BDF8)' }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">TACTICAL MAP</span>
          </div>
          <h1 className="text-base font-bold text-white">Live Operation Map</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Real-time field positions · {responders.length} units tracked
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { label:'Total',    count:responders.length, color:'#3B82F6' },
            { label:'Critical', count:critCount,         color:'#EF4444' },
            { label:'Warning',  count:warnCount,         color:'#F59E0B' },
            { label:'Safe',     count:safeCount,         color:'#22C55E' },
          ].map(({ label, count, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px]"
              style={{ background:`${color}12`, border:`1px solid ${color}25` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background:color, boxShadow:`0 0 4px ${color}` }} />
              <span className="text-slate-400">{label}</span>
              <span className="font-mono font-bold" style={{ color }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden p-3">
        <Suspense fallback={
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 rounded-2xl"
            style={{ background:'rgba(10,18,34,0.75)', border:'1px solid rgba(59,130,246,0.2)' }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            <span className="text-xs">Loading tactical map…</span>
          </div>
        }>
          <LiveMapWidget />
        </Suspense>
      </div>

      {/* Bottom responder strip */}
      <div
        className="shrink-0 px-4 py-2.5 overflow-x-auto"
        style={{
          background: 'rgba(6, 12, 24, 0.85)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(59,130,246,0.22)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex gap-2 min-w-max">
          {responders.map((r, i) => {
            const v    = liveVitals[r.badge_id] || {}
            const rri  = liveRRI[r.badge_id]    || {}
            const risk = rri.risk_level || 'normal'
            const color = RISK_COLOR[risk]
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:-translate-y-0.5"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}30`,
                  boxShadow: `0 0 10px ${color}20`,
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0 blink" style={{ background:color, boxShadow:`0 0 4px ${color}` }} />
                <span className="text-white text-[11px] font-semibold">{r.name}</span>
                <span className="font-mono text-[10px] text-hr">{v.heart_rate ? Number(v.heart_rate).toFixed(0) : '--'} BPM</span>
                <span className="font-mono text-[10px] text-spo2">{v.spo2 ? Number(v.spo2).toFixed(0) : '--'}%</span>
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ color, background:`${color}20`, border:`1px solid ${color}40` }}>
                  {risk}
                </span>
              </div>
            )
          })}
          {responders.length === 0 && (
            <span className="text-slate-500 text-xs py-1">No responders connected</span>
          )}
        </div>
      </div>
    </div>
  )
}
