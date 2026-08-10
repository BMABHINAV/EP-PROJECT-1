import { useState } from 'react'
import { BellRing, CheckCircle, Eye, ShieldAlert, Filter } from 'lucide-react'
import useStore from '../store/useStore'
import { acknowledgeAlert } from '../services/api'

const SEVERITY_ORDER = { critical:0, warning:1, info:2 }

const SEV = {
  critical: { icon:'⚠', color:'#EF4444', bg:'rgba(239,68,68,0.12)', border:'rgba(239,68,68,0.35)', glow:'rgba(239,68,68,0.25)', label:'CRITICAL' },
  warning:  { icon:'⚡', color:'#F59E0B', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', glow:'rgba(245,158,11,0.20)', label:'WARNING'  },
  info:     { icon:'ℹ', color:'#3B82F6', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.35)', glow:'rgba(59,130,246,0.15)', label:'INFO'     },
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now()-new Date(ts))/1000
  if (diff<10)   return 'just now'
  if (diff<60)   return `${Math.floor(diff)}s ago`
  if (diff<3600) return `${Math.floor(diff/60)}m ago`
  return new Date(ts).toLocaleTimeString([],{ hour:'2-digit', minute:'2-digit' })
}

function AlertCard({ alert, index, onAck }) {
  const s = SEV[alert.severity] || SEV.info
  const typeLabel = alert.alert_type?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Alert'
  const [leaving, setLeaving] = useState(false)

  function handleAck() { setLeaving(true); setTimeout(() => onAck(alert.id), 300) }

  return (
    <div
      className={`rounded-xl flex items-start gap-3 px-4 py-3.5 transition-all duration-300 backdrop-blur-md
        ${alert.severity==='critical' ? 'animate-shake' : 'animate-slide-right'}
        ${alert.acknowledged ? 'opacity-40' : ''}
        ${leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{
        background: alert.acknowledged ? 'rgba(10,18,34,0.4)' : s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: alert.acknowledged ? 'none' : `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${s.glow}`,
        animationDelay:`${index*50}ms`,
        animationFillMode:'both',
      }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5"
        style={{ background:s.bg, border:`1px solid ${s.border}` }}>
        {s.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-1">
          <span className="font-bold text-[11px] uppercase tracking-wide" style={{ color:s.color }}>{typeLabel}</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
            {s.label}
          </span>
          {alert.rri_at_alert!=null && (
            <span className="font-mono text-[9px] text-slate-400">RRI: {(alert.rri_at_alert*100).toFixed(1)}%</span>
          )}
        </div>
        <div className="text-[11px] text-slate-300 leading-snug mb-1.5">{alert.message}</div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-slate-500">{timeAgo(alert.time)}</span>
          {alert.resolved ? (
            <span className="flex items-center gap-1 text-[9px] text-safe"><CheckCircle size={9}/>Resolved</span>
          ) : alert.acknowledged ? (
            <span className="flex items-center gap-1 text-[9px] text-warn"><Eye size={9}/>Acknowledged</span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] text-crit blink"><ShieldAlert size={9}/>Active</span>
          )}
        </div>
      </div>
      {!alert.acknowledged && (
        <button onClick={handleAck}
          className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all btn-tactical"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#94A3B8' }}
        >
          ACK
        </button>
      )}
    </div>
  )
}

export default function AlertsPage() {
  const { alerts, acknowledgeAlert:ackLocal } = useStore()
  const [filter, setFilter] = useState('all')

  const filtered = alerts
    .filter(a => filter==='all' || a.severity===filter)
    .sort((a,b) => {
      if (!a.acknowledged && b.acknowledged) return -1
      if (a.acknowledged && !b.acknowledged) return 1
      return (SEVERITY_ORDER[a.severity]??3) - (SEVERITY_ORDER[b.severity]??3)
    })

  async function handleAck(id) { try { await acknowledgeAlert(id); ackLocal(id) } catch {} }

  const unacked = alerts.filter(a => !a.acknowledged).length
  const counts  = { critical:0, warning:0, info:0 }
  alerts.forEach(a => { if (counts[a.severity]!==undefined) counts[a.severity]++ })

  return (
    <div className="flex flex-col gap-5 p-5 min-h-full animate-fade-scale" style={{ background:'transparent' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Filter size={12} className="text-slate-500" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">ALERT OPERATIONS</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BellRing size={18} className="text-warn" style={{ filter:'drop-shadow(0 0 6px #F59E0B)' }} /> Alert Log
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            <span className="text-crit font-bold font-mono">{unacked}</span> unacknowledged ·{' '}
            <span className="font-mono">{filtered.length}</span> total
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'rgba(10, 18, 34, 0.75)', border:'1px solid rgba(59,130,246,0.2)', backdropFilter:'blur(16px)' }}>
          {['all','critical','warning','info'].map(f => {
            const cnt = f==='all' ? alerts.length : counts[f]||0
            const COLOR = { critical:'#EF4444', warning:'#F59E0B', info:'#3B82F6', all:'#CBD5E1' }
            const isActive = filter===f
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 btn-tactical"
                style={{
                  background: isActive ? `${COLOR[f]}18` : 'transparent',
                  color: isActive ? COLOR[f] : '#64748B',
                  border: isActive ? `1px solid ${COLOR[f]}35` : '1px solid transparent',
                  boxShadow: isActive ? `0 0 12px ${COLOR[f]}25` : undefined,
                }}
              >
                {f}
                {cnt>0 && (
                  <span className="font-mono text-[8px] px-1 rounded-full"
                    style={{ background:`${COLOR[f]}20`, color:COLOR[f] }}>
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length===0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 rounded-2xl"
          style={{ background:'rgba(10, 18, 34, 0.75)', border:'1px solid rgba(59,130,246,0.2)', backdropFilter:'blur(16px)' }}>
          <CheckCircle size={32} className="text-safe" style={{ filter:'drop-shadow(0 0 8px #22C55E)' }} />
          <p className="text-slate-300 font-medium">No alerts match this filter</p>
          <p className="text-slate-500 text-xs">All clear — system nominal</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((alert,i) => <AlertCard key={alert.id ? `${alert.id}-${i}` : `alert-${i}`} alert={alert} index={i} onAck={handleAck} />)}
        </div>
      )}
    </div>
  )
}
