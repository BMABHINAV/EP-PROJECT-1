import { useState } from 'react'
import { Users, AlertTriangle, Activity, Download, Shield } from 'lucide-react'
import useStore from '../store/useStore'
import ResponderCard from '../components/cards/ResponderCard'
import ResponderDetailModal from '../components/charts/ResponderDetailModal'
import CountUp from '../components/ui/CountUp'

export default function RespondersPage() {
  const { responders, liveRRI } = useStore()
  const [filter, setFilter] = useState('all')

  const criticalCount = Object.values(liveRRI).filter(r => r.risk_level==='critical').length
  const warningCount  = Object.values(liveRRI).filter(r => r.risk_level==='warning'||r.risk_level==='caution').length
  const safeCount     = Math.max(0, responders.length - criticalCount - warningCount)

  const filtered = filter==='all' ? responders : responders.filter(r => {
    const risk = liveRRI[r.badge_id]?.risk_level || 'normal'
    if (filter==='warning') return risk==='warning'||risk==='caution'
    return risk===filter
  })

  const STATS = [
    { label:'Total',    value:responders.length, color:'#3B82F6', bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.25)',  filter:'all'      },
    { label:'Critical', value:criticalCount,     color:'#EF4444', bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.25)',  filter:'critical' },
    { label:'Warning',  value:warningCount,      color:'#F59E0B', bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.25)',  filter:'warning'  },
    { label:'Safe',     value:safeCount,         color:'#22C55E', bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.25)',  filter:'normal'   },
  ]

  return (
    <div className="flex flex-col gap-5 p-5 min-h-full animate-fade-scale" style={{ background:'transparent' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={13} className="text-brand" style={{ filter:'drop-shadow(0 0 5px #3B82F6)' }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">MISSION ALPHA · FIELD UNITS</span>
          </div>
          <h1 className="text-xl font-bold text-white">Field Responders</h1>
          <p className="text-slate-400 text-xs mt-1">{responders.length} units tracked — real-time vitals via MQTT</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium btn-tactical"
          style={{ background:'rgba(10, 18, 34, 0.75)', border:'1px solid rgba(59,130,246,0.22)', color:'#94A3B8' }}>
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {STATS.map(({ label, value, color, bg, border, filter:f }) => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 btn-tactical"
            style={{
              background: filter===f ? bg : 'rgba(10, 18, 34, 0.75)',
              border: filter===f ? `1px solid ${border}` : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(16px)',
              boxShadow: filter===f ? `0 0 16px ${color}30` : '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <span className="font-mono font-bold text-lg leading-none" style={{ color, textShadow:`0 0 8px ${color}60` }}>
              <CountUp value={value} decimals={0} />
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: filter===f ? color : '#64748B' }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length===0 && responders.length===0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-2xl py-24"
          style={{ background:'rgba(10, 18, 34, 0.75)', border:'1px solid rgba(59,130,246,0.2)', backdropFilter:'blur(16px)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)' }}>
            <Activity size={28} className="text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-slate-300 font-medium">No responders connected</p>
            <p className="text-slate-500 text-xs mt-1">Start the sensor simulator to see live data</p>
          </div>
        </div>
      ) : filtered.length===0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No responders match this filter</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((r,i) => (
            <div key={r.id} className="animate-fade-scale" style={{ animationDelay:`${i*50}ms`, animationFillMode:'both' }}>
              <ResponderCard responder={r} />
            </div>
          ))}
        </div>
      )}
      <ResponderDetailModal />
    </div>
  )
}
