import { Suspense, lazy } from 'react'
import {
  Users, ShieldCheck, AlertTriangle, Flag, Bell, TrendingUp,
  ArrowUpRight, Activity, Wind, Droplets, HeartPulse, Thermometer, Eye
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import useStore from '../store/useStore'
import ResponderDetailModal from '../components/charts/ResponderDetailModal'

const LiveMapWidget = lazy(() => import('../components/map/LiveMapWidget'))

// ─── avatar colors by index ──────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#22c55e','#06b6d4','#f43f5e','#a78bfa']
const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length]

// ─── risk badge ──────────────────────────────────────────────────────
const RISK = {
  normal:   { cls:'bg-safe/10 text-safe border-safe/25',     label:'SAFE'     },
  caution:  { cls:'bg-warn/10 text-warn border-warn/25',     label:'CAUTION'  },
  warning:  { cls:'bg-warn/10 text-warn border-warn/25',     label:'WARNING'  },
  critical: { cls:'bg-crit/10 text-crit border-crit/25',     label:'CRITICAL' },
}

// ─── Alert severity ───────────────────────────────────────────────────
const SEV = {
  critical: { border:'border-crit/50',  dot:'bg-crit',  text:'text-crit',  icon:'⚠' },
  warning:  { border:'border-warn/50',  dot:'bg-warn',  text:'text-warn',  icon:'🩸' },
  info:     { border:'border-brand/50', dot:'bg-brand', text:'text-brand', icon:'ℹ' },
}

// ─── Mission timeline data ────────────────────────────────────────────
const MISSION_EVENTS = [
  { time:'09:00', label:'Mission Started', sub:'Urban Building Collapse',  color:'#3b82f6' },
  { time:'09:15', label:'Team Alpha Deployed', sub:'10 Responders',        color:'#22c55e' },
  { time:'09:45', label:'High Gas Detected', sub:'Zone A',                 color:'#f59e0b' },
  { time:'10:10', label:'Medical Support Arrived', sub:'Base Camp',        color:'#8b5cf6' },
]

// ─── Widget header ────────────────────────────────────────────────────
function WidgetHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</span>
      {action && <button className="text-[10px] text-brand hover:text-blue-300 transition-colors">{action}</button>}
    </div>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl bg-dash-card border border-dash-border2 p-3 ${className}`}>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { responders, summary, alerts, liveRRI, liveVitals, liveGas, history } = useStore()

  // ── Derived stats ─────────────────────────────────────────────────────
  const critCount  = Object.values(liveRRI).filter(r => r.risk_level === 'critical').length
  const warnCount  = Object.values(liveRRI).filter(r => r.risk_level === 'warning' || r.risk_level === 'caution').length
  const safeCount  = responders.length - critCount - warnCount
  const totalAlerts = (summary.alert_counts?.critical || 0) + (summary.alert_counts?.warning || 0) + (summary.alert_counts?.info || 0)

  // ── Vitals chart data (merge all history) ─────────────────────────────
  const firstBadge = responders[0]?.badge_id
  const chartData  = (history[firstBadge] || []).slice(-20).map(d => ({
    time: d.time,
    hr:   d.hr   ? Number(d.hr).toFixed(0)   : null,
    spo2: d.spo2 ? Number(d.spo2).toFixed(1) : null,
  }))

  // ── Gas data (average across all responders) ──────────────────────────
  const gasVals = (() => {
    const all = Object.values(liveGas)
    if (!all.length) return { co: 0, no2: 0, nh3: 0, o2: 20.9 }
    const avg = (key) => all.reduce((s,g) => s + (g[key] || 0), 0) / all.length
    return { co: avg('co_ppm'), no2: avg('no2_ppm'), nh3: avg('nh3_ppm'), o2: avg('o2_percent') || 20.9 }
  })()

  // ── Risk donut data ────────────────────────────────────────────────────
  const dist = summary.risk_distribution || {}
  const donutData = [
    { name: 'Safe',     value: dist.normal   || safeCount, color: '#22c55e' },
    { name: 'Warning',  value: dist.warning  || warnCount, color: '#f59e0b' },
    { name: 'Critical', value: dist.critical || critCount, color: '#ef4444' },
  ].filter(d => d.value > 0)
  if (!donutData.length) donutData.push({ name: 'No data', value: 1, color: '#1e293b' })

  // deduplicate alerts by alert_type+severity, show only latest of each kind, cap at 50
  const recentAlerts = Object.values(
    alerts.reduce((acc, a) => {
      const key = `${a.alert_type}-${a.severity}`
      if (!acc[key] || new Date(a.time) > new Date(acc[key].time)) acc[key] = a
      return acc
    }, {})
  ).sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 50)

  return (
    <div className="flex flex-col gap-4 p-4 min-h-full bg-dash-bg animate-fade-in">

      {/* ── KPI Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard
          icon={<Users size={20} className="text-blue-400" />}
          iconBg="bg-blue-500/10 border-blue-500/20"
          label="Total Responders"
          value={summary.total_active_responders || 0}
          sub={`+4 from last hour`}
          glow="card-glow-blue"
        />
        <KpiCard
          icon={<ShieldCheck size={20} className="text-safe" />}
          iconBg="bg-safe/10 border-safe/20"
          label="Safe"
          value={safeCount}
          badge={`${responders.length ? ((safeCount / responders.length) * 100).toFixed(1) : 0}%`}
          badgeColor="text-safe"
          glow="card-glow-green"
        />
        <KpiCard
          icon={<AlertTriangle size={20} className="text-warn" />}
          iconBg="bg-warn/10 border-warn/20"
          label="Warning"
          value={warnCount}
          badge={`+7.1%`}
          badgeColor="text-warn"
          glow="card-glow-amber"
        />
        <KpiCard
          icon={<AlertTriangle size={20} className="text-crit" />}
          iconBg="bg-crit/10 border-crit/20"
          label="Critical"
          value={critCount}
          badge={`+2.4%`}
          badgeColor="text-crit"
          glow="card-glow-red"
        />
        <KpiCard
          icon={<Flag size={20} className="text-mis" />}
          iconBg="bg-mis/10 border-mis/20"
          label="Active Missions"
          value={3}
          sub="Ongoing"
          glow="card-glow-purp"
        />
        <KpiCard
          icon={<Bell size={20} className="text-warn" />}
          iconBg="bg-warn/10 border-warn/20"
          label="Total Alerts"
          value={totalAlerts}
          sub="Last 24h"
          glow="card-glow-amber"
        />
      </div>

      {/* ── Main 3-col row ─────────────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '44% 28% 28%' }}>

        {/* Live Operation Map */}
        <Card className="!p-0 overflow-hidden flex flex-col" style={{ minHeight: 280 }}>
          <div className="px-3 pt-3 pb-2">
            <WidgetHeader title="Live Operation Map" action="View All" />
          </div>
          <div className="flex-1 relative" style={{ minHeight: 240 }}>
            <Suspense fallback={
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">Loading map…</div>
            }>
              <LiveMapWidget />
            </Suspense>
          </div>
        </Card>

        {/* Responder Status Overview */}
        <Card className="flex flex-col">
          <WidgetHeader title="Responder Status Overview" action="View All" />
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-64">
            {responders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-xs">No responders connected</div>
            ) : responders.slice(0, 7).map((r, i) => {
              const v    = liveVitals[r.badge_id] || {}
              const rri  = liveRRI[r.badge_id]    || {}
              const risk = rri.risk_level || 'normal'
              const { cls, label } = RISK[risk] || RISK.normal
              return (
                <div
                  key={r.id}
                  onClick={() => useStore.getState().setSelectedResponder(r.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-dash-card2 hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-dash-border"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background: avatarColor(i) }}
                  >
                    {r.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[11px] font-semibold truncate">{r.name}</div>
                    <div className="text-slate-500 text-[9px] truncate">{r.role}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-[11px] font-bold text-hr">{v.heart_rate ? Number(v.heart_rate).toFixed(0) : '--'} <span className="font-normal text-[9px] text-slate-500">BPM</span></div>
                      <div className="font-mono text-[11px] font-bold text-spo2">{v.spo2 ? Number(v.spo2).toFixed(0) : '--'}<span className="font-normal text-[9px] text-slate-500">%</span></div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${cls}`}>{label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Live Vitals + Risk Overview */}
        <Card className="flex flex-col">
          <WidgetHeader title="Live Vitals & Risk Overview" action="View All" />
          {/* Mini legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
            {[['#f43f5e','Heart Rate (BPM)'],['#06b6d4','SpO₂ (%)'],['#a78bfa','RRI'],['#fb923c','Temp (°C)']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1 text-[9px] text-slate-500">
                <span className="w-3 h-0.5 rounded-full" style={{ background: c }} />{l}
              </div>
            ))}
          </div>
          <div className="flex-1" style={{ minHeight: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top:5, right:5, bottom:0, left:-25 }}>
                <XAxis dataKey="time" tick={{ fontSize:8, fill:'#475569' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8, fill:'#475569' }} />
                <Tooltip contentStyle={{ backgroundColor:'#0c1428', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, fontSize:11 }} />
                <Line type="monotone" dataKey="hr"   stroke="#f43f5e" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="spo2" stroke="#06b6d4" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Recent Alerts — minimal scrollable feed ─────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recent Alerts</span>
            {recentAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-dash-card2 border border-dash-border2 text-[9px] font-mono text-slate-400">{recentAlerts.length}</span>
            )}
          </div>
          <button className="text-[10px] text-brand hover:text-blue-300" onClick={() => window.location.hash = '/alerts'}>View All →</button>
        </div>
        <div className="rounded-xl bg-dash-card border border-dash-border2 overflow-hidden">
          {recentAlerts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-600 text-xs">
              <span className="text-safe text-base">✓</span> No active alerts
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {recentAlerts.map(alert => {
                const s = SEV[alert.severity] || SEV.info
                const typeLabel = alert.alert_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Alert'
                return (
                  <div key={alert.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-dash-border2 border-l-2 last:border-b-0 ${s.border} hover:bg-white/[0.02] transition-colors`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className={`text-[11px] font-semibold ${s.text} shrink-0 w-36 truncate`}>{typeLabel}</span>
                    <span className="text-[10px] text-slate-500 flex-1 truncate">{alert.message}</span>
                    <span className="text-[9px] text-slate-600 font-mono shrink-0">
                      {alert.time ? new Date(alert.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Gas | Risk Donut | Mission Timeline ───────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '30% 25% 1fr' }}>

        {/* Gas Exposure */}
        <Card>
          <WidgetHeader title="Gas Exposure (PPM)" />
          <div className="flex flex-col gap-3">
            {[
              { label:'CO',  value: gasVals.co,  limit:50,  color:'#a78bfa', unit:'ppm' },
              { label:'NO₂', value: gasVals.no2, limit:5,   color:'#f43f5e', unit:'ppm' },
              { label:'NH₃', value: gasVals.nh3, limit:300, color:'#fb923c', unit:'ppm' },
              { label:'O₂',  value: gasVals.o2,  limit:25,  color:'#06b6d4', unit:'%' },
            ].map(({ label, value, limit, color, unit }) => {
              const pct = Math.min((value / limit) * 100, 100)
              const alert = value > limit * 0.8
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-400 font-medium">{label}</span>
                    <span className={`font-mono text-[11px] font-bold ${alert ? 'text-crit' : 'text-slate-300'}`}>
                      {Number(value).toFixed(1)} <span className="text-slate-500 font-normal text-[9px]">{unit}</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${pct}%`, background: alert ? '#ef4444' : color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Risk Index Donut */}
        <Card className="flex flex-col">
          <WidgetHeader title="Risk Index Distribution" />
          <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 120 }}>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor:'#0c1428', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, fontSize:11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-xl font-bold text-white">{responders.length}</span>
              <span className="text-[9px] text-slate-500">Total</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-col gap-1 mt-1">
            {donutData.filter(d => d.name !== 'No data').map(d => (
              <div key={d.name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-slate-400">{d.name}</span>
                </div>
                <span className="font-mono text-slate-300 font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Mission Timeline */}
        <Card>
          <WidgetHeader title="Mission Timeline" action="View All" />
          <div className="relative flex flex-col gap-3">
            {/* Vertical line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-dash-border2" />
            {MISSION_EVENTS.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 pl-1">
                <div className="relative z-10 mt-0.5">
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: ev.color, background:'#0c1428' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: ev.color }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-slate-500">{ev.time}</span>
                    <span className="text-[10px] font-semibold text-white">{ev.label}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{ev.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Responder Modal */}
      <ResponderDetailModal />
    </div>
  )
}

// ─── KPI Card sub-component ───────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, sub, badge, badgeColor, glow }) {
  return (
    <div className={`rounded-xl bg-dash-card border border-dash-border2 p-3 ${glow} flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg border ${iconBg}`}>
          {icon}
        </div>
        {badge && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${badgeColor}`}>
            <TrendingUp size={10} />{badge}
          </div>
        )}
      </div>
      <div>
        <div className="font-mono text-2xl font-bold text-white leading-tight">{value}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub || label}</div>
      </div>
      <div className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">{label}</div>
    </div>
  )
}
