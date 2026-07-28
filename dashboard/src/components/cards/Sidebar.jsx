import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Shield, LayoutDashboard, Users, Map, BellRing, BarChart2,
  Brain, Flag, Cpu, FileText, Settings, ChevronRight,
  Wifi, WifiOff
} from 'lucide-react'
import useStore from '../../store/useStore'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/responders', icon: Users,            label: 'Responders' },
  { to: '/map',        icon: Map,              label: 'Live Map' },
  { to: '/alerts',     icon: BellRing,         label: 'Alerts',       badge: true },
  { to: '/analytics',  icon: BarChart2,        label: 'Analytics' },
  { to: '/ai',         icon: Brain,            label: 'AI Predictions' },
  { to: '/mission',    icon: Flag,             label: 'Missions' },
  { to: '/dashboard',  icon: Cpu,              label: 'Devices' },
  { to: '/dashboard',  icon: FileText,         label: 'Reports' },
  { to: '/dashboard',  icon: Settings,         label: 'Settings' },
]

export default function Sidebar() {
  const { unacknowledgedCount, wsConnected } = useStore()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="flex flex-col w-[200px] shrink-0 h-full bg-dash-sidebar border-r border-dash-border overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-dash-border2">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 shadow-glow">
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm tracking-wider leading-tight">RESCUE</div>
          <div className="text-slate-500 text-[9px] tracking-widest uppercase leading-tight">Command System</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {NAV.map(({ to, icon: Icon, label, expand, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 group
              ${isActive
                ? 'bg-brand/15 text-brand border border-brand/20 shadow-glow'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'text-brand' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1 truncate">{label}</span>
                {badge && unacknowledgedCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-crit text-white text-[9px] font-bold blink">
                    {unacknowledgedCount}
                  </span>
                )}
                {expand && <ChevronRight size={11} className="text-slate-600 group-hover:text-slate-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-dash-border2 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            C
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dash-sidebar ${wsConnected ? 'bg-safe' : 'bg-slate-500'}`} />
          </div>
          <div className="min-w-0">
            <div className="text-white text-[11px] font-semibold truncate">Commander</div>
            <div className="text-slate-500 text-[9px] truncate">Mission Control</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-safe blink' : 'bg-slate-500'}`} />
          <span className={`text-[9px] ${wsConnected ? 'text-safe' : 'text-slate-500'}`}>
            {wsConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  )
}
