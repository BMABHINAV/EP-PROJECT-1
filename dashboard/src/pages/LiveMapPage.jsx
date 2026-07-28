import { Suspense } from 'react'
import LiveMapWidget from '../components/map/LiveMapWidget'
import useStore from '../store/useStore'

const RISK_COLOR = { normal:'#22c55e', caution:'#f59e0b', warning:'#f97316', critical:'#ef4444' }

export default function LiveMapPage() {
  const { responders, liveRRI, liveVitals } = useStore()
  const critCount = Object.values(liveRRI).filter(r => r.risk_level === 'critical').length
  const warnCount = Object.values(liveRRI).filter(r => r.risk_level === 'warning' || r.risk_level === 'caution').length

  return (
    <div className="flex flex-col h-full bg-dash-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-dash-border2 shrink-0">
        <div>
          <h1 className="text-base font-bold text-white">Live Operation Map</h1>
          <p className="text-slate-500 text-[10px] mt-0.5">Real-time field positions · {responders.length} units tracked</p>
        </div>
        {/* Status pills */}
        <div className="flex gap-2">
          {[
            { label: 'Total', count: responders.length, color: '#3b82f6' },
            { label: 'Critical', count: critCount, color: '#ef4444' },
            { label: 'Warning', count: warnCount, color: '#f59e0b' },
            { label: 'Safe', count: responders.length - critCount - warnCount, color: '#22c55e' },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dash-card border border-dash-border2 text-[11px]">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-slate-400">{label}</span>
              <span className="font-mono font-bold text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen map */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-slate-600">Loading map…</div>
        }>
          <LiveMapWidget fullscreen />
        </Suspense>
      </div>

      {/* Responder list overlay bottom */}
      <div className="shrink-0 border-t border-dash-border2 bg-dash-sidebar/95 backdrop-blur-sm px-4 py-2 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {responders.map((r, i) => {
            const v    = liveVitals[r.badge_id] || {}
            const rri  = liveRRI[r.badge_id]    || {}
            const risk = rri.risk_level || 'normal'
            const color = RISK_COLOR[risk]
            return (
              <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dash-card border border-dash-border2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-white text-[11px] font-semibold">{r.name}</span>
                <span className="text-[10px] font-mono text-hr">{v.heart_rate ? Number(v.heart_rate).toFixed(0) : '--'} BPM</span>
                <span className="text-[10px] font-mono text-spo2">{v.spo2 ? Number(v.spo2).toFixed(0) : '--'}%</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ color, background: color + '20', border: `1px solid ${color}40` }}>
                  {risk}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
