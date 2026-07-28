import { useState, useEffect } from 'react'
import { Search, Bell, MessageSquare, ChevronDown } from 'lucide-react'
import useStore from '../../store/useStore'

export default function TopBar() {
  const { wsConnected, unacknowledgedCount } = useStore()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-[60px] px-6 
                       bg-dash-sidebar border-b border-dash-border backdrop-blur-sm shrink-0">
      {/* Left: Title */}
      <div>
        <div className="text-white font-bold text-base tracking-tight leading-tight">
          WEB DASHBOARD <span className="text-slate-400 font-normal">(COMMAND CENTER)</span>
        </div>
        <div className="text-slate-500 text-[10px] mt-0.5 leading-tight">
          Real-time monitoring, analytics & decision support for commanders
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dash-card border border-dash-border2 w-64 mx-6">
        <Search size={13} className="text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search responder, mission..."
          className="flex-1 bg-transparent text-slate-300 text-xs placeholder-slate-600 outline-none"
        />
      </div>

      {/* Right: Actions + Time */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <button className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-dash-card border border-dash-border2 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <Bell size={14} />
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-crit text-white text-[8px] font-bold flex items-center justify-center blink">
              {unacknowledgedCount}
            </span>
          )}
        </button>

        {/* Chat */}
        <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-dash-card border border-dash-border2 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <MessageSquare size={14} />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-dash-card border border-dash-border2 cursor-pointer hover:bg-white/5 transition-all">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center text-white text-[10px] font-bold">
            C
          </div>
          <span className="text-slate-300 text-xs font-medium">Commander</span>
          <ChevronDown size={11} className="text-slate-500" />
        </div>

        {/* Live status dot */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium
          ${wsConnected
            ? 'bg-safe/10 border-safe/25 text-safe'
            : 'bg-crit/10 border-crit/25 text-crit'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-safe blink' : 'bg-crit'}`} />
          {wsConnected ? 'LIVE' : 'OFFLINE'}
        </div>

        {/* Time */}
        <div className="text-right">
          <div className="font-mono text-white text-[13px] font-semibold leading-tight">{timeStr}</div>
          <div className="text-slate-500 text-[9px] leading-tight">{dateStr}</div>
        </div>
      </div>
    </header>
  )
}
