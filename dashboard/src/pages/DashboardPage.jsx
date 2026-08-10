import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  Users, ShieldCheck, AlertTriangle, Flag, Bell, Brain, ChevronRight
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import useStore from '../store/useStore'
import ResponderDetailModal from '../components/charts/ResponderDetailModal'
import AlertFeed from '../components/ui/AlertToast'
import CountUp from '../components/ui/CountUp'
import { acknowledgeAlert } from '../services/api'
import { RRI_GRADIENT, riskColor, riskMeta, rriPercent, sortRespondersByRisk } from '../utils/risk'

const LiveMapWidget = lazy(() => import('../components/map/LiveMapWidget'))

const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#F59E0B','#EF4444','#22C55E','#06B6D4','#F43F5E','#A78BFA']
const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length]

const MISSION_EVENTS = [
  { time:'09:00', label:'Mission Started',      sub:'Urban Building Collapse', color:'#3B82F6' },
  { time:'09:15', label:'Team Alpha Deployed',  sub:'5 Responders active',     color:'#22C55E' },
  { time:'09:45', label:'High Gas Detected',    sub:'Zone A — CO > 80 ppm',    color:'#F59E0B' },
  { time:'10:10', label:'AI Warning Issued',    sub:'RRI > 0.75 for R-004',    color:'#EF4444' },
  { time:'10:22', label:'Medical On Site',      sub:'Base Camp',               color:'#8B5CF6' },
]

const TT = {
  backgroundColor: 'rgba(6, 12, 24, 0.92)',
  border: '1px solid rgba(59, 130, 246, 0.35)',
  borderRadius: 10,
  fontSize: 11,
  backdropFilter: 'blur(12px)',
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
      <div className="w-3 h-px bg-brand/50" />
      {children}
    </div>
  )
}

function GlassPanel({ children, className='', style={} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'rgba(10, 18, 34, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(59, 130, 246, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function KpiStat({ icon, label, value, color, sub, pulse, last }) {
  return (
    <div
      className="flex-1 flex flex-col gap-1 px-4 py-3 relative group cursor-default"
      style={{ borderRight: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full blink" style={{ background:color, boxShadow:`0 0 6px ${color}` }} />}
      </div>
      <div className="font-mono font-bold leading-none" style={{ fontSize:22, color, textShadow:`0 0 10px ${color}60` }}>
        <CountUp value={Number(value)||0} decimals={0} />
      </div>
      <div className="text-[9px] text-slate-400 uppercase tracking-widest leading-none font-medium">{label}</div>
      {sub && <div className="text-[9px] text-slate-500">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { responders, summary, alerts, liveRRI, liveVitals, liveGas, history, selectedResponderId, setSelectedResponder } = useStore()
  const [rightTab, setRightTab] = useState('responders')
  const { acknowledgeAlert: ackLocal } = useStore()

  async function handleAck(id) {
    try { await acknowledgeAlert(id); ackLocal(id) } catch { /* ignore */ }
  }

  const riskSortedResponders = useMemo(() => sortRespondersByRisk(responders, liveRRI), [responders, liveRRI])
  const focusedResponder = riskSortedResponders.find(r => r.id === selectedResponderId || r.badge_id === selectedResponderId) || riskSortedResponders[0]

  useEffect(() => {
    if (focusedResponder && selectedResponderId !== focusedResponder.id) {
      setSelectedResponder(focusedResponder.id)
    }
  }, [focusedResponder?.id])


  const critCount  = Object.values(liveRRI).filter(r => r.risk_level==='critical').length
  const warnCount  = Object.values(liveRRI).filter(r => r.risk_level==='warning'||r.risk_level==='caution').length
  const safeCount  = Math.max(0, responders.length - critCount - warnCount)
  const totalAlerts = (summary.alert_counts?.critical||0) + (summary.alert_counts?.warning||0) + (summary.alert_counts?.info||0)

  const firstBadge = focusedResponder?.badge_id
  const chartData  = (history[firstBadge]||[]).slice(-20).map(d => ({ time:d.time, hr:d.hr?Number(d.hr).toFixed(0):null, spo2:d.spo2?Number(d.spo2).toFixed(1):null }))

  const gasVals = (() => {
    const all = Object.values(liveGas)
    if (!all.length) return { co:0, no2:0, nh3:0, o2:20.9 }
    const avg = k => all.reduce((s,g) => s+(g[k]||0),0) / all.length
    return { co:avg('co_ppm'), no2:avg('no2_ppm'), nh3:avg('nh3_ppm'), o2:avg('o2_percent')||20.9 }
  })()

  const dist = summary.risk_distribution||{}
  const donutData = [
    { name:'Safe',    value:dist.normal  ||safeCount,  color:'#22C55E' },
    { name:'Warning', value:dist.warning ||warnCount,  color:'#F59E0B' },
    { name:'Critical',value:dist.critical||critCount,  color:'#EF4444' },
  ].filter(d => d.value > 0)
  if (!donutData.length) donutData.push({ name:'No data', value:1, color:'#1E293B' })

  const recentAlerts = Object.values(
    alerts.reduce((acc,a) => {
      const key=`${a.alert_type}-${a.severity}`
      if (!acc[key]||new Date(a.time)>new Date(acc[key].time)) acc[key]=a
      return acc
    }, {})
  ).sort((a,b) => new Date(b.time)-new Date(a.time)).slice(0,30)

  return (
    <div className="flex flex-col gap-3 p-4 min-h-full animate-fade-scale" style={{ background:'transparent' }}>

      {/* KPI Strip */}
      <GlassPanel className="flex overflow-hidden" style={{ minHeight:68 }}>
        <KpiStat icon={<Users size={14}/>}        label="Responders" value={summary.total_active_responders||responders.length} color="#3B82F6" />
        <KpiStat icon={<ShieldCheck size={14}/>}  label="Safe"       value={safeCount}   color="#22C55E" />
        <KpiStat icon={<AlertTriangle size={14}/>} label="Warning"   value={warnCount}   color="#F59E0B" />
        <KpiStat icon={<AlertTriangle size={14}/>} label="Critical"  value={critCount}   color="#EF4444" pulse={critCount>0} />
        <KpiStat icon={<Flag size={14}/>}          label="Missions"  value={3}            color="#8B5CF6" sub="Active" />
        <KpiStat icon={<Bell size={14}/>}          label="Alerts"    value={totalAlerts}  color="#F59E0B" sub="Last 24h" last />
      </GlassPanel>

      {focusedResponder && (() => {
        const badge = focusedResponder.badge_id
        const v = liveVitals[badge] || {}
        const g = liveGas[badge] || {}
        const rri = liveRRI[badge] || {}
        const raw = rri.rri ?? 0
        const color = riskColor(raw)
        const meta = riskMeta(rri.risk_level || raw)
        return (
          <GlassPanel className="grid grid-cols-[220px_1fr_260px] gap-4 p-4 items-center" style={{ border:`1px solid ${color}55`, boxShadow:`0 8px 32px rgba(0,0,0,0.55), 0 0 26px ${color}25` }}>
            <div>
              <SectionLabel>Auto-focused Highest Risk</SectionLabel>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background:color, boxShadow:`0 0 16px ${color}66` }}>{focusedResponder.name.charAt(0)}</div>
                <div>
                  <div className="text-white font-bold text-sm">{focusedResponder.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">{badge} · {focusedResponder.team}</div>
                  <div className="text-[9px] font-bold uppercase mt-1" style={{ color }}>{meta.label}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[{label:'HR', value:v.heart_rate?`${Number(v.heart_rate).toFixed(0)} BPM`:'--', color:'#F43F5E'}, {label:'SpO₂', value:v.spo2?`${Number(v.spo2).toFixed(1)}%`:'--', color:'#06B6D4'}, {label:'CO', value:g.co_ppm?`${Number(g.co_ppm).toFixed(1)} PPM`:'--', color:'#A78BFA'}, {label:'TEMP', value:v.body_temp_c?`${Number(v.body_temp_c).toFixed(1)}°C`:'--', color:'#FB923C'}].map(item => (
                <div key={item.label} className="rounded-xl px-3 py-2" style={{ background:'rgba(255,255,255,0.035)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">{item.label}</div>
                  <div className="font-mono text-lg font-bold tabular-nums" style={{ color:item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full" style={{ background:`conic-gradient(${RRI_GRADIENT.replace('linear-gradient(90deg,', '').replace(')', '')} ${rriPercent(raw)}%, rgba(255,255,255,0.06) 0)`, boxShadow:`0 0 18px ${color}33` }}>
                <div className="absolute inset-2 rounded-full flex flex-col items-center justify-center" style={{ background:'rgba(6,12,24,0.95)' }}>
                  <span className="font-mono text-xl font-bold tabular-nums" style={{ color }}>{rriPercent(raw)}</span>
                  <span className="text-[8px] text-slate-500">RRI %</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Continuous Risk</div>
                <div className="h-2 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width:`${rriPercent(raw)}%`, background:RRI_GRADIENT, boxShadow:`0 0 10px ${color}` }} /></div>
                <div className="flex justify-between font-mono text-[8px] text-slate-500 mt-1"><span>0</span><span>30</span><span>60</span><span>80</span><span>100</span></div>
              </div>
            </div>
          </GlassPanel>
        )
      })()}

      {/* Main Row: Map + Right Panel */}
      <div className="flex gap-3" style={{ minHeight:'calc(100vh - 320px)' }}>

        {/* Tactical Map */}
        <GlassPanel className="flex-1 flex flex-col overflow-hidden" style={{ padding:0 }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <span className="live-dot" style={{ width:7, height:7 }} />
              <SectionLabel>Live Tactical Map</SectionLabel>
            </div>
            <button className="text-[9px] text-brand uppercase tracking-widest font-semibold flex items-center gap-0.5 btn-tactical">
              Full Screen <ChevronRight size={9} />
            </button>
          </div>
          <div className="flex-1 relative" style={{ minHeight:300 }}>
            <Suspense fallback={
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-7 h-7 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                <span className="text-xs">Loading map…</span>
              </div>
            }>
              <LiveMapWidget />
            </Suspense>
          </div>
        </GlassPanel>

        {/* Right Panel */}
        <GlassPanel className="flex flex-col overflow-hidden" style={{ width:260, padding:0 }}>
          <div className="flex shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {[
              { id:'responders', label:'Responders', icon:<Users size={10}/> },
              { id:'ai',         label:'AI Intel',   icon:<Brain size={10}/> },
            ].map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-all ${
                  rightTab===tab.id ? 'text-brand border-b-2 border-brand bg-brand/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {rightTab==='responders' && (
            <div className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto feed-scroll">
              {riskSortedResponders.length===0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">No responders</div>
              ) : riskSortedResponders.slice(0,8).map((r,i) => {
                const v=liveVitals[r.badge_id]||{}; const rri=liveRRI[r.badge_id]||{}
                const risk=rri.risk_level||'normal'; const meta=riskMeta(risk)
                const rriRaw = rri.rri ?? 0
                const rriPct = rriPercent(rriRaw)
                return (
                  <div key={r.id} onClick={() => useStore.getState().setSelectedResponder(r.id)}
                    className="p-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40"
                    style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background:riskColor(rriRaw), boxShadow:`0 0 6px ${riskColor(rriRaw)}60` }}>
                        {r.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-[11px] font-semibold truncate leading-tight">{r.name}</div>
                        <div className="text-slate-400 text-[9px] truncate">{r.role}</div>
                      </div>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background:meta.bg, color:meta.color, border:`1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden bg-white/5">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${rriPct}%`, background:RRI_GRADIENT, boxShadow:`0 0 6px ${riskColor(rriRaw)}` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-mono text-[9px] text-slate-400">❤ {v.heart_rate?Number(v.heart_rate).toFixed(0):'--'}</span>
                      <span className="font-mono text-[9px] text-slate-400">O₂ {v.spo2?Number(v.spo2).toFixed(0):'--'}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {rightTab==='ai' && (
            <div className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto feed-scroll">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.22)' }}>
                <Brain size={12} className="text-mis" />
                <span className="text-[10px] text-mis font-semibold">Neural Network Active</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" style={{ width:80, height:80 }}>
                  <ResponsiveContainer width={80} height={80}>
                    <PieChart>
                      <Pie data={donutData} cx={38} cy={38} innerRadius={26} outerRadius={38} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                        {donutData.map((d,i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-mono text-base font-bold text-white">{responders.length}</span>
                    <span className="text-[7px] text-slate-400">TOTAL</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {donutData.filter(d=>d.name!=='No data').map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background:d.color, boxShadow:`0 0 4px ${d.color}` }} />
                        <span className="text-[9px] text-slate-400">{d.name}</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-200">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {chartData.length>1 && (
                <div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1 font-medium">Live Vitals</div>
                  <div style={{ height:80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top:2,right:2,bottom:0,left:-30 }}>
                        <defs>
                          <linearGradient id="hrGDark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.00} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={['auto','auto']} />
                        <Tooltip contentStyle={TT} />
                        <Area type="monotone" dataKey="hr" stroke="#F43F5E" fill="url(#hrGDark)" strokeWidth={1.5} dot={false} connectNulls name="HR" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {[{ label:'CO', value:gasVals.co, limit:50, color:'#A78BFA' },
                  { label:'O₂', value:gasVals.o2, limit:25, color:'#06B6D4' }].map(({ label, value, limit, color }) => {
                  const pct=Math.min((value/limit)*100,100); const danger=value>limit*0.8
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] text-slate-400">{label}</span>
                        <span className="font-mono text-[9px] font-bold" style={{ color:danger?'#EF4444':color }}>{Number(value).toFixed(1)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background:danger?'#EF4444':color, boxShadow:`0 0 6px ${color}` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr 240px' }}>
        {/* Alert Feed */}
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Recent Alerts</SectionLabel>
            {recentAlerts.length>0 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.3)' }}>
                {recentAlerts.length}
              </span>
            )}
          </div>
          <AlertFeed alerts={recentAlerts} onAcknowledge={handleAck} maxHeight={160} />
        </GlassPanel>

        {/* Timeline */}
        <GlassPanel className="p-3">
          <SectionLabel>Mission Timeline</SectionLabel>
          <div className="relative flex flex-col gap-2.5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background:'linear-gradient(180deg,rgba(59,130,246,0.4),rgba(59,130,246,0.05))' }} />
            {MISSION_EVENTS.map((ev,i) => (
              <div key={i} className="flex items-start gap-3 animate-slide-left" style={{ animationDelay:`${i*80}ms`, animationFillMode:'both' }}>
                <div className="relative z-10 shrink-0 mt-0.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor:ev.color, background:'#050A14', boxShadow:`0 0 6px ${ev.color}60` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background:ev.color }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[9px] text-slate-500">{ev.time}</span>
                    <span className="text-[10px] font-semibold text-white truncate">{ev.label}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">{ev.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Gas */}
        <GlassPanel className="p-3">
          <SectionLabel>Gas Exposure</SectionLabel>
          <div className="flex flex-col gap-3">
            {[
              { label:'CO',  value:gasVals.co,  limit:50,  color:'#A78BFA', unit:'ppm' },
              { label:'NO₂', value:gasVals.no2, limit:5,   color:'#F43F5E', unit:'ppm' },
              { label:'NH₃', value:gasVals.nh3, limit:300, color:'#FB923C', unit:'ppm' },
              { label:'O₂',  value:gasVals.o2,  limit:25,  color:'#06B6D4', unit:'%'   },
            ].map(({ label, value, limit, color, unit }) => {
              const pct=Math.min((value/limit)*100,100); const danger=value>limit*0.8
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-400 font-medium">{label}</span>
                    <span className="font-mono text-[10px] font-bold" style={{ color:danger?'#EF4444':color }}>
                      {Number(value).toFixed(1)} <span className="text-slate-500 font-normal text-[8px]">{unit}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${pct}%`, background:danger?'#EF4444':color, boxShadow:`0 0 6px ${color}` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassPanel>
      </div>

      <ResponderDetailModal />
    </div>
  )
}
