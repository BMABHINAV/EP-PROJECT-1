import { X, HeartPulse, Droplets } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useStore from '../../store/useStore'

export default function ResponderDetailModal() {
  const { selectedResponderId, setSelectedResponder, history, responders, liveVitals, liveGas, liveRRI } = useStore()
  if (!selectedResponderId) return null

  const r    = responders.find(r => r.id === selectedResponderId) || { name: 'Unknown', badge_id: String(selectedResponderId) }
  const hist = (history[selectedResponderId] || []).slice(-30)
  const v    = liveVitals[r.badge_id] || {}
  const g    = liveGas[r.badge_id]    || {}
  const rri  = liveRRI[r.badge_id]    || {}
  const risk = rri.risk_level || 'normal'
  const RISK_COLOR = { normal:'#22c55e', caution:'#f59e0b', warning:'#f97316', critical:'#ef4444' }
  const rColor = RISK_COLOR[risk]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-fade-in"
         onClick={() => setSelectedResponder(null)}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-dash-card border border-dash-border overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center text-white font-bold text-sm">
              {r.name.charAt(0)}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{r.name}</div>
              <div className="text-slate-500 text-[10px]">{r.badge_id} · {r.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border"
              style={{ color: rColor, borderColor: rColor + '40', background: rColor + '15' }}>
              {risk}
            </span>
            <button onClick={() => setSelectedResponder(null)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-dash-border2">
          {[
            { icon:<HeartPulse size={14} className="text-hr" />, label:'Heart Rate', value: v.heart_rate ? `${Number(v.heart_rate).toFixed(0)} bpm` : '--', color:'text-hr' },
            { icon:<Droplets size={14} className="text-spo2" />, label:'SpO2',       value: v.spo2 ? `${Number(v.spo2).toFixed(1)}%` : '--', color:'text-spo2' },
            { icon:<span className="text-temp text-xs font-bold">°C</span>, label:'Temp', value: v.body_temp_c ? `${Number(v.body_temp_c).toFixed(1)}°C` : '--', color:'text-temp' },
            { icon:<span className="text-co text-[10px] font-bold">CO</span>, label:'CO Exposure', value: g.co_ppm ? `${Number(g.co_ppm).toFixed(1)} ppm` : '--', color: (g.co_ppm||0) > 25 ? 'text-crit' : 'text-co' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="rounded-lg bg-dash-card2 px-3 py-2 border border-dash-border2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">{icon}{label}</div>
              <div className={`font-mono text-base font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {hist.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Waiting for telemetry data…</div>
          ) : (
            <>
              <ChartSection title="Heart Rate (bpm)" dataKey="hr" color="#f43f5e" data={hist} />
              <ChartSection title="Blood Oxygen SpO2 (%)" dataKey="spo2" color="#06b6d4" data={hist} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ChartSection({ title, dataKey, color, data }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</div>
      <div className="rounded-xl bg-dash-card2 border border-dash-border2 p-3" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:5, right:5, bottom:0, left:-20 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize:8, fill:'#475569' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize:8, fill:'#475569' }} />
            <Tooltip contentStyle={{ backgroundColor:'#0c1428', border:`1px solid ${color}40`, borderRadius:8, fontSize:11 }} />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#g-${dataKey})`} strokeWidth={1.5} dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
