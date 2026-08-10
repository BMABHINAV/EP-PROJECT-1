import { useEffect, useState } from 'react'

const SEV = {
  critical: { border:'rgba(239,68,68,0.35)',  bg:'rgba(239,68,68,0.12)', text:'#EF4444', icon:'⚠', iconBg:'rgba(239,68,68,0.18)' },
  warning:  { border:'rgba(245,158,11,0.35)', bg:'rgba(245,158,11,0.12)', text:'#F59E0B', icon:'⚡', iconBg:'rgba(245,158,11,0.18)' },
  info:     { border:'rgba(59,130,246,0.35)', bg:'rgba(59,130,246,0.12)', text:'#3B82F6', icon:'ℹ',  iconBg:'rgba(59,130,246,0.18)' },
}

export function AlertToast({ alert, onAcknowledge, index=0 }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const s = SEV[alert.severity] || SEV.info
  const typeLabel = alert.alert_type?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Alert'
  const timeStr = alert.time
    ? (() => {
        const diff = (Date.now()-new Date(alert.time))/1000
        if (diff<10) return 'just now'
        if (diff<60) return `${Math.floor(diff)}s ago`
        if (diff<3600) return `${Math.floor(diff/60)}m ago`
        return new Date(alert.time).toLocaleTimeString([],{ hour:'2-digit',minute:'2-digit' })
      })()
    : ''

  useEffect(() => { const t=setTimeout(()=>setVisible(true), Math.min(index*40, 400)); return ()=>clearTimeout(t) }, [index])

  function handleAck() { setLeaving(true); setTimeout(()=>onAcknowledge?.(alert.id),300) }

  return (
    <div
      className={`relative rounded-xl border px-3 py-2.5 flex items-start gap-2.5 cursor-default transition-all duration-300 backdrop-blur-md
        ${alert.severity==='critical' ? 'animate-shake' : ''}
        ${alert.acknowledged ? 'opacity-40' : ''}
        ${visible && !leaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
      `}
      style={{
        background: alert.acknowledged ? 'rgba(10,18,34,0.4)' : s.bg,
        borderColor: s.border,
        boxShadow: visible ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
        transitionDelay:`${Math.min(index*30, 300)}ms`,
      }}
    >
      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-sm"
        style={{ background:s.iconBg }}>
        <span style={{ color:s.text }}>{s.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color:s.text }}>{typeLabel}</span>
          <span className="font-mono text-[9px] text-slate-400">{timeStr}</span>
        </div>
        <div className="text-[11px] text-slate-300 truncate">{alert.message}</div>
      </div>
      {!alert.acknowledged && onAcknowledge && (
        <button onClick={handleAck}
          className="shrink-0 text-[9px] text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20 btn-tactical">
          ACK
        </button>
      )}
    </div>
  )
}

export default function AlertFeed({ alerts=[], onAcknowledge, maxHeight=280 }) {
  return (
    <div className="flex flex-col gap-1.5 feed-scroll" style={{ maxHeight, overflowY:'auto' }}>
      {alerts.length===0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-xs">
          <span className="text-safe text-lg">✓</span> No active alerts
        </div>
      ) : alerts.map((a,i) => (
        <AlertToast key={a.id ? `${a.id}-${i}` : `alert-${i}`} alert={a} onAcknowledge={onAcknowledge} index={i} />
      ))}
    </div>
  )
}
