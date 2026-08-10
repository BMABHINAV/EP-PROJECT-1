import { useState, useEffect, useRef } from 'react'
import { Shield, Brain, Battery, Volume2, VolumeX, Wifi } from 'lucide-react'
import useStore from '../../store/useStore'
import SoundManager from '../ui/SoundManager'

export default function TopBar() {
  const { wsConnected, unacknowledgedCount, responders, summary } = useStore()
  const [now, setNow]         = useState(new Date())
  const [soundOn, setSoundOn] = useState(false)
  const [connPct]             = useState(98)
  const prevAlerts            = useRef(unacknowledgedCount)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (unacknowledgedCount > prevAlerts.current) SoundManager.alertBeep()
    prevAlerts.current = unacknowledgedCount
  }, [unacknowledgedCount])

  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })
  const dateStr = now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })

  function toggleSound() {
    const on = SoundManager.toggle()
    setSoundOn(on)
    SoundManager.unlock()
    if (on) SoundManager.beep()
  }

  const totalResponders = responders.length || summary.total_active_responders || 0

  return (
    <header
      className="sticky top-0 z-50 flex items-center h-[58px] px-5 gap-4 shrink-0"
      style={{
        background: 'rgba(6, 12, 24, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.22)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(59, 130, 246, 0.15)',
      }}
    >
      {/* ── Left: Brand ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 0 16px rgba(59, 130, 246, 0.5)' }}
        >
          <Shield size={15} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-[13px] tracking-widest uppercase leading-none">MISSION ALPHA</span>
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background:'rgba(34,197,94,0.15)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.3)' }}
            >
              ACTIVE
            </span>
          </div>
          <div className="text-[9px] text-slate-400 tracking-wider mt-0.5">RESQ COMMAND · URBAN RESCUE OPS</div>
        </div>
      </div>

      {/* ── Center: Live KPI Pills ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {[
          { label:'RESPONDERS', value: totalResponders, color:'#3B82F6', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.25)', icon:'👤' },
          { label:'ACTIVE ZONES', value: 3,               color:'#A78BFA', bg:'rgba(167,139,250,0.12)', border:'rgba(167,139,250,0.25)', icon:'🗺' },
          { label:'ALERTS',       value: unacknowledgedCount, color: unacknowledgedCount > 0 ? '#EF4444' : '#22C55E', bg: unacknowledgedCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)', border: unacknowledgedCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)', icon:'⚠', pulse: unacknowledgedCount > 0 },
          { label:'CONNECTION',   value:`${connPct}%`,    color:'#22C55E', bg:'rgba(34,197,94,0.12)', border:'rgba(34,197,94,0.25)', icon:<Wifi size={10} /> },
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background:item.bg, border:`1px solid ${item.border}` }}
          >
            <span className="text-[10px]">{typeof item.icon === 'string' ? item.icon : item.icon}</span>
            <span className="font-mono font-bold text-[13px]" style={{ color: item.color, textShadow:`0 0 8px ${item.color}60` }}>{item.value}</span>
            <span className="text-[8px] text-slate-400 uppercase tracking-widest">{item.label}</span>
            {item.pulse && <span className="w-1.5 h-1.5 rounded-full blink" style={{ background:item.color, boxShadow:`0 0 6px ${item.color}` }} />}
          </div>
        ))}
      </div>

      {/* ── Right: System Status ─────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.25)' }}
        >
          <Brain size={11} className="text-mis" />
          <span className="text-[9px] font-bold text-mis tracking-wider uppercase">AI ACTIVE</span>
        </div>

        {/* Battery */}
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
          style={{ background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.25)' }}
        >
          <Battery size={11} className="text-safe" />
          <span className="font-mono text-[10px] text-safe font-bold">87%</span>
        </div>

        {/* LIVE pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold tracking-widest"
          style={{
            background: wsConnected ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
            border: wsConnected ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(100,116,139,0.2)',
            color: wsConnected ? '#22C55E' : '#94A3B8',
          }}
        >
          {wsConnected
            ? <span className="live-dot" style={{ width:7, height:7 }} />
            : <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          }
          {wsConnected ? 'LIVE' : 'OFFLINE'}
        </div>

        {/* Sound */}
        <button
          onClick={toggleSound}
          className="flex items-center justify-center w-7 h-7 rounded-xl transition-all btn-tactical"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}
          title={soundOn ? 'Mute alerts' : 'Enable sounds'}
        >
          {soundOn
            ? <Volume2 size={12} className="text-brand" />
            : <VolumeX size={12} className="text-slate-400" />
          }
        </button>

        {/* Clock */}
        <div className="text-right border-l border-white/10 pl-3 ml-1">
          <div className="font-mono text-white text-[14px] font-bold leading-none tracking-wider" style={{ textShadow:'0 0 8px rgba(59,130,246,0.5)' }}>{timeStr}</div>
          <div className="text-slate-400 text-[8px] leading-none mt-0.5 tracking-wider">{dateStr}</div>
        </div>
      </div>
    </header>
  )
}
