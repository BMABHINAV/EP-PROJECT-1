import { X, HeartPulse, Droplets, Thermometer, Wind } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useStore from '../../store/useStore'

export default function ResponderDetailModal() {
  const { selectedResponderId, setSelectedResponder, history, responders, liveVitals, liveGas, liveRRI } = useStore()
  if (!selectedResponderId) return null

  const r    = responders.find(r => r.id === selectedResponderId || r.badge_id === selectedResponderId) || { name: 'Unknown Responder', badge_id: String(selectedResponderId), role: 'Field Unit' }
  const hist = (history[r.badge_id] || history[selectedResponderId] || []).slice(-30)
  const v    = liveVitals[r.badge_id] || {}
  const g    = liveGas[r.badge_id]    || {}
  const rri  = liveRRI[r.badge_id]    || {}
  const risk = rri.risk_level || 'normal'
  const RISK_COLOR = { normal:'#22C55E', caution:'#F59E0B', warning:'#F97316', critical:'#EF4444' }
  const rColor = RISK_COLOR[risk] || RISK_COLOR.normal

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => setSelectedResponder(null)}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
        style={{
          background: 'rgba(10, 18, 34, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header accent bar */}
        <div style={{ height:3, background:`linear-gradient(90deg,${rColor}60,${rColor},${rColor}60)`, boxShadow:`0 0 10px ${rColor}` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background:`linear-gradient(135deg, ${rColor}70, ${rColor})`, boxShadow:`0 0 12px ${rColor}50` }}
            >
              {r.name.charAt(0)}
            </div>
            <div>
              <div className="text-white font-bold text-base">{r.name}</div>
              <div className="text-slate-400 text-xs mt-0.5">
                <span className="font-mono text-slate-300">{r.badge_id}</span> · {r.role}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
              style={{ color: rColor, borderColor: `${rColor}50`, background: `${rColor}15`, boxShadow:`0 0 10px ${rColor}30` }}
            >
              {risk}
            </span>
            <button
              onClick={() => setSelectedResponder(null)}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all btn-tactical"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick telemetry stats */}
        <div className="grid grid-cols-4 gap-3 px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            { icon:<HeartPulse size={14} className="text-hr" />, label:'Heart Rate', value: v.heart_rate ? `${Number(v.heart_rate).toFixed(0)} bpm` : '--', color:'text-hr' },
            { icon:<Droplets size={14} className="text-spo2" />, label:'SpO₂',       value: v.spo2 ? `${Number(v.spo2).toFixed(1)}%` : '--', color:'text-spo2' },
            { icon:<Thermometer size={14} className="text-temp" />, label:'Body Temp', value: v.body_temp_c ? `${Number(v.body_temp_c).toFixed(1)}°C` : '--', color:'text-temp' },
            { icon:<Wind size={14} className="text-co" />, label:'CO Exposure', value: g.co_ppm ? `${Number(g.co_ppm).toFixed(1)} ppm` : '--', color: (g.co_ppm||0) > 25 ? 'text-crit' : 'text-co' },
          ].map(({ icon, label, value, color }) => (
            <div
              key={label}
              className="rounded-xl px-3 py-2.5"
              style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">{icon}{label}</div>
              <div className={`font-mono text-base font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Real-time telemetry charts */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 feed-scroll">
          {hist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              Waiting for live telemetry stream…
            </div>
          ) : (
            <>
              <ChartSection title="Heart Rate History (bpm)" dataKey="hr" color="#f43f5e" data={hist} />
              <ChartSection title="Blood Oxygen SpO₂ History (%)" dataKey="spo2" color="#06b6d4" data={hist} />
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
      <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">{title}</div>
      <div
        className="rounded-xl p-3 flex items-center justify-center overflow-hidden"
        style={{ height: 160, background:'rgba(6,12,24,0.6)', border:'1px solid rgba(255,255,255,0.06)' }}
      >
        <ResponsiveContainer width="99%" height={140}>
          <AreaChart data={data} margin={{ top:5, right:15, bottom:0, left:-20 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize:8, fill:'#64748B' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize:8, fill:'#64748B' }} domain={['auto','auto']} />
            <Tooltip contentStyle={{ backgroundColor:'rgba(6,12,24,0.95)', border:`1px solid ${color}40`, borderRadius:10, fontSize:11, backdropFilter:'blur(12px)' }} />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#g-${dataKey})`} strokeWidth={2} dot={false} connectNulls style={{ filter:`drop-shadow(0 0 4px ${color})` }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
