import { useState, useEffect } from 'react'
import { Flag, Clock, Users, Map, Zap } from 'lucide-react'
import { fetchMissions } from '../services/api'
import useStore from '../store/useStore'

const FALLBACK_MISSIONS = [
  {
    id:'M-001', name:'Urban Building Collapse', status:'active', location:'Zone A, Sector 7',
    responders:5, startTime:new Date(Date.now()-65*60000).toISOString(), priority:'critical',
    description:'Structural collapse with possible survivors. High CO levels detected.',
    events:[
      { time:new Date(Date.now()-65*60000).toISOString(), label:'Mission Started',     color:'#3B82F6', icon:'🚀' },
      { time:new Date(Date.now()-50*60000).toISOString(), label:'Team Alpha Deployed', color:'#22C55E', icon:'👥' },
      { time:new Date(Date.now()-20*60000).toISOString(), label:'High CO Detected',    color:'#F59E0B', icon:'⚠'  },
      { time:new Date(Date.now()-10*60000).toISOString(), label:'Medical On Site',     color:'#8B5CF6', icon:'🏥' },
    ]
  },
  {
    id:'M-002', name:'Chemical Spill Response', status:'standby', location:'Zone C, Industrial',
    responders:3, startTime:new Date(Date.now()-15*60000).toISOString(), priority:'warning',
    description:'Hazardous chemical spill at industrial facility. Standby protocol initiated.',
    events:[
      { time:new Date(Date.now()-15*60000).toISOString(), label:'Standby Initiated', color:'#F59E0B', icon:'⏸' },
      { time:new Date(Date.now()-8*60000).toISOString(),  label:'Team Bravo Ready',  color:'#06B6D4', icon:'✅' },
    ]
  },
  {
    id:'M-003', name:'Forest Fire Perimeter', status:'completed', location:'Zone B, Northern Ridge',
    responders:8, startTime:new Date(Date.now()-240*60000).toISOString(), priority:'normal',
    description:'Perimeter containment mission. Successfully completed.',
    events:[
      { time:new Date(Date.now()-240*60000).toISOString(), label:'Mission Started',   color:'#3B82F6', icon:'🚀' },
      { time:new Date(Date.now()-120*60000).toISOString(), label:'Perimeter Secured', color:'#22C55E', icon:'🛡'  },
      { time:new Date(Date.now()-30*60000).toISOString(),  label:'Mission Complete',  color:'#22C55E', icon:'✅' },
    ]
  },
]

const STATUS = {
  active:    { color:'#22C55E', label:'ACTIVE',    bg:'rgba(34,197,94,0.15)',   border:'rgba(34,197,94,0.35)'   },
  standby:   { color:'#F59E0B', label:'STANDBY',   bg:'rgba(245,158,11,0.15)',  border:'rgba(245,158,11,0.35)'  },
  completed: { color:'#64748B', label:'COMPLETED', bg:'rgba(100,116,139,0.15)', border:'rgba(100,116,139,0.3)'  },
}

const PRI = {
  critical: { color:'#EF4444', label:'CRITICAL', pct:100 },
  warning:  { color:'#F59E0B', label:'HIGH',     pct:60  },
  normal:   { color:'#22C55E', label:'NORMAL',   pct:30  },
}

function useElapsed(isoStart) {
  const [, forceRender] = useState(0)
  useEffect(() => { const iv=setInterval(()=>forceRender(n=>n+1),1000); return ()=>clearInterval(iv) }, [])
  const ms=Date.now()-new Date(isoStart).getTime()
  const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000), s=Math.floor((ms%60000)/1000)
  if (h>0) return `${h}h ${m}m`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function MissionCard({ mission, index }) {
  const st  = STATUS[mission.status] || STATUS.completed
  const pri = PRI[mission.priority]  || PRI.normal
  const elapsed    = useElapsed(mission.startTime)
  const isActive   = mission.status === 'active'

  return (
    <div
      className="rounded-2xl flex flex-col gap-4 p-5 transition-all duration-250 hover:-translate-y-1 animate-fade-scale"
      style={{
        background:'rgba(10, 18, 34, 0.78)',
        backdropFilter:'blur(16px)',
        WebkitBackdropFilter:'blur(16px)',
        border: isActive ? `1px solid ${st.color}40` : '1px solid rgba(59,130,246,0.2)',
        boxShadow: isActive ? `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${st.color}25` : '0 8px 32px rgba(0,0,0,0.5)',
        animationDelay:`${index*80}ms`, animationFillMode:'both',
      }}
    >
      {/* Priority bar */}
      <div style={{ height:2.5, background:`linear-gradient(90deg,${pri.color}50,${pri.color},${pri.color}50)`, borderRadius:2, boxShadow:`0 0 8px ${pri.color}` }} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[9px] text-slate-500 mb-0.5">{mission.id}</div>
          <div className="text-white font-bold text-[14px] leading-tight">{mission.name}</div>
          <div className="text-[10px] text-slate-400 mt-1">{mission.description}</div>
        </div>
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ml-3"
          style={{ background:st.bg, color:st.color, border:`1px solid ${st.border}` }}>
          {isActive && <span className="live-dot" style={{ width:6, height:6 }} />}
          {st.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon:<Map size={11}/>,   label:'Zone',    val:mission.location.split(',')[0] },
          { icon:<Users size={11}/>, label:'Units',   val:mission.responders, mono:true },
          { icon:<Clock size={11}/>, label:'Elapsed', val:elapsed, mono:true, live:isActive },
        ].map(({ icon, label, val, mono, live }) => (
          <div key={label} className="rounded-xl px-3 py-2.5 text-center"
            style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
              {icon}
              <span className="text-[8px] uppercase tracking-widest">{label}</span>
              {live && <span className="live-dot" style={{ width:5,height:5 }} />}
            </div>
            <div className={`font-semibold text-[11px] text-white leading-tight ${mono?'font-mono':''}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Priority bar */}
      <div>
        <div className="flex justify-between text-[9px] mb-1.5">
          <span className="text-slate-500 uppercase tracking-widest">Priority</span>
          <span className="font-bold" style={{ color:pri.color }}>{pri.label}</span>
        </div>
        <div className="h-1 rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width:`${pri.pct}%`, background:`linear-gradient(90deg,${pri.color}80,${pri.color})`, boxShadow:`0 0 6px ${pri.color}` }} />
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold mb-2.5">Event Timeline</div>
        <div className="relative flex flex-col gap-2.5">
          <div className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{ background:`linear-gradient(180deg,${pri.color}60,${pri.color}10)` }} />
          {mission.events.map((ev,i) => (
            <div key={i} className="flex items-start gap-2.5 animate-slide-left"
              style={{ animationDelay:`${i*60}ms`, animationFillMode:'both' }}>
              <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 z-10 text-[7px]"
                style={{ borderColor:ev.color, background:'#050A14', boxShadow:`0 0 6px ${ev.color}60` }}>
                {ev.icon}
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white leading-tight">{ev.label}</div>
                <div className="font-mono text-[9px] text-slate-500">{new Date(ev.time).toLocaleTimeString([],{ hour:'2-digit',minute:'2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function normalizeMission(m, responders) {
  const activeResponders = responders?.length || 0
  const startedAt = m.started_at || m.startTime || new Date().toISOString()
  const hazard = Number(m.hazard_level || 1)
  const priority = hazard >= 4 ? 'critical' : hazard >= 3 ? 'warning' : 'normal'
  return {
    id: m.mission_code || m.id || 'MISSION',
    name: m.name || 'Field Operation',
    status: m.status || 'active',
    location: m.location || 'Unknown zone',
    responders: m.responders || activeResponders,
    startTime: startedAt,
    priority,
    description: m.notes || `Hazard level ${hazard} operation with live responder telemetry.`,
    events: m.events || [
      { time: startedAt, label: 'Mission Created', color: '#3B82F6', icon: '🚀' },
      { time: new Date().toISOString(), label: `${activeResponders} Responders Linked`, color: '#22C55E', icon: '👥' },
    ],
  }
}

export default function MissionPage() {
  const { responders } = useStore()
  const [missions, setMissions] = useState(FALLBACK_MISSIONS)

  useEffect(() => {
    fetchMissions()
      .then(data => {
        if (Array.isArray(data) && data.length) setMissions(data.map(m => normalizeMission(m, responders)))
      })
      .catch(() => setMissions(FALLBACK_MISSIONS))
  }, [responders])

  const activeCnt=missions.filter(m=>m.status==='active').length
  const standbyCnt=missions.filter(m=>m.status==='standby').length
  const completedCnt=missions.filter(m=>m.status==='completed').length

  return (
    <div className="flex flex-col gap-5 p-5 min-h-full animate-fade-scale" style={{ background:'transparent' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-slate-500" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">FIELD OPERATIONS</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Flag size={18} className="text-mis" style={{ filter:'drop-shadow(0 0 6px #A78BFA)' }} /> Missions
          </h1>
          <p className="text-slate-400 text-xs mt-1">Active field operations & mission timeline</p>
        </div>
        <div className="flex gap-2">
          {[
            { label:'Active',    cnt:activeCnt,    color:'#22C55E', bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.25)'  },
            { label:'Standby',   cnt:standbyCnt,   color:'#F59E0B', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.25)'  },
            { label:'Completed', cnt:completedCnt, color:'#64748B', bg:'rgba(100,116,139,0.12)',border:'rgba(100,116,139,0.2)' },
          ].map(({ label, cnt, color, bg, border }) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px]"
              style={{ background:bg, border:`1px solid ${border}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background:color, boxShadow:`0 0 4px ${color}` }} />
              <span style={{ color }}>{label}</span>
              <span className="font-mono font-bold" style={{ color }}>{cnt}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {missions.map((m,i) => <MissionCard key={m.id} mission={m} index={i} />)}
      </div>
    </div>
  )
}
