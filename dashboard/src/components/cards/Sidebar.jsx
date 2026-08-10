import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Shield, LayoutDashboard, Users, Map, BellRing, BarChart2,
  Brain, Flag, Settings, ChevronLeft, ChevronRight
} from 'lucide-react'
import useStore from '../../store/useStore'

const NAV = [
  { to:'/dashboard',  icon:LayoutDashboard, label:'Dashboard',   color:'#3B82F6' },
  { to:'/responders', icon:Users,            label:'Responders',  color:'#22C55E' },
  { to:'/map',        icon:Map,              label:'Live Map',    color:'#38BDF8' },
  { to:'/alerts',     icon:BellRing,         label:'Alerts',      color:'#EF4444', badge:true },
  { to:'/analytics',  icon:BarChart2,        label:'Analytics',   color:'#F59E0B' },
  { to:'/ai',         icon:Brain,            label:'AI Intel',    color:'#A78BFA' },
  { to:'/mission',    icon:Flag,             label:'Missions',    color:'#06B6D4' },
  { to:'/dashboard',  icon:Settings,         label:'Settings',    color:'#64748B' },
]

export default function Sidebar() {
  const { unacknowledgedCount, wsConnected } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })

  return (
    <aside
      className="flex flex-col shrink-0 h-full transition-all duration-300 overflow-hidden"
      style={{
        width: collapsed ? 54 : 196,
        background: 'rgba(6, 12, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: '4px 0 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-3.5 shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{ background:'linear-gradient(135deg, #1D4ED8, #7C3AED)', boxShadow:'0 0 14px rgba(59,130,246,0.45)' }}
        >
          <Shield size={14} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-[12px] tracking-widest uppercase leading-tight whitespace-nowrap">ResQ</div>
            <div className="text-slate-400 text-[8px] tracking-widest uppercase leading-tight whitespace-nowrap">Command</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto feed-scroll">
        {NAV.map(({ to, icon:Icon, label, color, badge }) => (
          <NavLink
            key={label}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-xl transition-all duration-200
               ${collapsed ? 'px-0 justify-center py-2.5' : 'px-3 py-2'}
               ${isActive ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  style={{
                    color: isActive ? color : undefined,
                    filter: isActive ? `drop-shadow(0 0 6px ${color})` : undefined,
                    transition:'all 0.2s', flexShrink:0
                  }}
                  className={!isActive ? 'group-hover:text-slate-200' : ''}
                />
                {!collapsed && (
                  <span
                    className="text-[11px] font-medium flex-1 truncate transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: isActive ? color : undefined }}
                  >
                    {label}
                  </span>
                )}
                {badge && unacknowledgedCount > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full text-white text-[8px] font-bold blink shrink-0"
                    style={{ minWidth:16, height:16, background:'#EF4444', boxShadow:'0 0 8px rgba(239,68,68,0.6)', padding:'0 4px' }}
                  >
                    {unacknowledgedCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-center py-2 transition-all hover:bg-white/5 shrink-0"
        style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}
      >
        {collapsed ? <ChevronRight size={12} className="text-slate-400" /> : <ChevronLeft size={12} className="text-slate-400" />}
      </button>

      {/* User area */}
      <div
        className={`px-3 py-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}
        style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}
      >
        {collapsed ? (
          <div className="relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', boxShadow:'0 0 10px rgba(59,130,246,0.4)' }}
          >
            C
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#060C1A] ${wsConnected ? 'bg-safe' : 'bg-slate-500'}`} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', boxShadow:'0 0 10px rgba(59,130,246,0.4)' }}
            >
              C
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#060C1A] ${wsConnected ? 'bg-safe' : 'bg-slate-500'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 text-[10px] font-semibold truncate">Commander</div>
              <div className="text-slate-500 text-[8px] font-mono truncate">{timeStr}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
