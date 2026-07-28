import { Flag, Clock, CheckCircle, AlertTriangle, Users, Map } from 'lucide-react'

const MISSIONS = [
  {
    id: 'M-001',
    name: 'Urban Building Collapse',
    status: 'active',
    location: 'Zone A, Sector 7',
    responders: 5,
    startTime: new Date(Date.now() - 65 * 60000).toISOString(),
    priority: 'critical',
    events: [
      { time: new Date(Date.now() - 65*60000).toISOString(), label:'Mission Started',     color:'#3b82f6', icon:'🚀' },
      { time: new Date(Date.now() - 50*60000).toISOString(), label:'Team Alpha Deployed', color:'#22c55e', icon:'👥' },
      { time: new Date(Date.now() - 20*60000).toISOString(), label:'High Gas Detected',   color:'#f59e0b', icon:'⚠' },
      { time: new Date(Date.now() - 10*60000).toISOString(), label:'Medical on Site',     color:'#8b5cf6', icon:'🏥' },
    ]
  },
  {
    id: 'M-002',
    name: 'Chemical Spill Response',
    status: 'standby',
    location: 'Zone C, Industrial',
    responders: 3,
    startTime: new Date(Date.now() - 15 * 60000).toISOString(),
    priority: 'warning',
    events: [
      { time: new Date(Date.now() - 15*60000).toISOString(), label:'Standby Initiated',   color:'#f59e0b', icon:'⏸' },
      { time: new Date(Date.now() - 8*60000).toISOString(),  label:'Team Bravo Ready',    color:'#06b6d4', icon:'✅' },
    ]
  },
  {
    id: 'M-003',
    name: 'Forest Fire Perimeter',
    status: 'completed',
    location: 'Zone B, Northern Ridge',
    responders: 8,
    startTime: new Date(Date.now() - 240 * 60000).toISOString(),
    priority: 'normal',
    events: [
      { time: new Date(Date.now() - 240*60000).toISOString(), label:'Mission Started',    color:'#3b82f6', icon:'🚀' },
      { time: new Date(Date.now() - 120*60000).toISOString(), label:'Perimeter Secured',  color:'#22c55e', icon:'🛡' },
      { time: new Date(Date.now() - 30*60000).toISOString(),  label:'Mission Completed',  color:'#22c55e', icon:'✅' },
    ]
  },
]

const STATUS_META = {
  active:    { cls:'bg-safe/10 text-safe border-safe/25',    label:'ACTIVE',    dot:'bg-safe blink' },
  standby:   { cls:'bg-warn/10 text-warn border-warn/25',    label:'STANDBY',   dot:'bg-warn' },
  completed: { cls:'bg-slate-500/10 text-slate-400 border-slate-500/20', label:'COMPLETED', dot:'bg-slate-500' },
}

const PRI_COLOR = { critical:'#ef4444', warning:'#f59e0b', normal:'#22c55e' }

function elapsed(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MissionPage() {
  return (
    <div className="flex flex-col gap-5 p-5 min-h-full bg-dash-bg">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Flag size={18} className="text-mis" />
            Missions
          </h1>
          <p className="text-slate-500 text-[10px] mt-0.5">Active field operations & mission timeline</p>
        </div>
        <div className="flex gap-2 text-[10px]">
          {[['Active','#22c55e',1], ['Standby','#f59e0b',1], ['Completed','#475569',1]].map(([l,c,n]) => (
            <div key={l} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dash-card border border-dash-border2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
              <span className="text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mission cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {MISSIONS.map(m => {
          const s = STATUS_META[m.status] || STATUS_META.completed
          const priColor = PRI_COLOR[m.priority] || '#22c55e'
          return (
            <div key={m.id} className="rounded-xl bg-dash-card border border-dash-border2 p-4 flex flex-col gap-4">
              {/* Mission header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">{m.id}</div>
                  <div className="text-white font-bold text-[13px] mt-0.5">{m.name}</div>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-dash-card2 px-2 py-1.5 text-center">
                  <Map size={12} className="text-slate-500 mx-auto mb-1" />
                  <div className="text-[9px] text-slate-500">Location</div>
                  <div className="text-[10px] text-white font-semibold truncate">{m.location.split(',')[0]}</div>
                </div>
                <div className="rounded-lg bg-dash-card2 px-2 py-1.5 text-center">
                  <Users size={12} className="text-slate-500 mx-auto mb-1" />
                  <div className="text-[9px] text-slate-500">Units</div>
                  <div className="font-mono text-base font-bold text-brand">{m.responders}</div>
                </div>
                <div className="rounded-lg bg-dash-card2 px-2 py-1.5 text-center">
                  <Clock size={12} className="text-slate-500 mx-auto mb-1" />
                  <div className="text-[9px] text-slate-500">Elapsed</div>
                  <div className="font-mono text-[11px] font-bold text-white">{elapsed(m.startTime)}</div>
                </div>
              </div>

              {/* Priority bar */}
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-slate-500">Priority</span>
                  <span className="font-bold uppercase" style={{ color: priColor }}>{m.priority}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full">
                  <div className="h-full rounded-full w-full" style={{ background: priColor + '60' }} />
                </div>
              </div>

              {/* Event timeline */}
              <div className="relative">
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Timeline</div>
                <div className="absolute left-[7px] top-7 bottom-0 w-px bg-dash-border2" />
                <div className="flex flex-col gap-2.5">
                  {m.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5 pl-0.5">
                      <div className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 text-[7px] mt-0.5 z-10 bg-dash-card"
                        style={{ borderColor: ev.color }}>
                        <span>{ev.icon}</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-white">{ev.label}</div>
                        <div className="text-[9px] font-mono text-slate-500">
                          {new Date(ev.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
