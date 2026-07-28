import { useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { HeartPulse, Droplets, Thermometer, Wind, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import useStore from '../store/useStore'

const TT_STYLE = {
  backgroundColor: '#0c1428',
  border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 8,
  fontSize: 11,
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-dash-card border border-dash-border2 p-4 flex flex-col gap-3 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</span>
      {children}
    </div>
  )
}

function StatPill({ icon, label, value, delta, color }) {
  const up = delta >= 0
  return (
    <div className="flex-1 rounded-lg bg-dash-card2 border border-dash-border2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">{icon}<span>{label}</span></div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-xl font-bold" style={{ color }}>{value}</span>
        {delta != null && (
          <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${up ? 'text-crit' : 'text-safe'}`}>
            {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { responders, history, liveVitals, liveGas } = useStore()

  // Build merged timeline from all responders
  const allHistData = useMemo(() => {
    const byTime = {}
    responders.forEach((r, i) => {
      const h = history[r.id] || history[r.badge_id] || []
      h.forEach(d => {
        if (!byTime[d.time]) byTime[d.time] = { time: d.time }
        if (d.hr)   byTime[d.time][`hr_${r.badge_id}`]   = Number(d.hr).toFixed(0)
        if (d.spo2) byTime[d.time][`spo2_${r.badge_id}`] = Number(d.spo2).toFixed(1)
      })
    })
    return Object.values(byTime).sort((a, b) => a.time?.localeCompare(b.time)).slice(-30)
  }, [responders, history])

  // First responder history for individual charts
  const firstR   = responders[0]
  const firstHist = firstR ? (history[firstR.id] || history[firstR.badge_id] || []).slice(-30) : []

  // Current vitals averages
  const liveArr = responders.map(r => liveVitals[r.badge_id] || {})
  const avgHR   = liveArr.length ? liveArr.reduce((s,v) => s + (v.heart_rate || 0), 0) / liveArr.length : 0
  const avgSpO2 = liveArr.length ? liveArr.reduce((s,v) => s + (v.spo2 || 0), 0) / liveArr.length : 0
  const avgTemp = liveArr.length ? liveArr.reduce((s,v) => s + (v.body_temp_c || 0), 0) / liveArr.length : 0

  // Gas averages
  const gasArr   = responders.map(r => liveGas[r.badge_id] || {})
  const avgCO    = gasArr.length ? gasArr.reduce((s,g) => s + (g.co_ppm || 0), 0) / gasArr.length : 0
  const avgNO2   = gasArr.length ? gasArr.reduce((s,g) => s + (g.no2_ppm || 0), 0) / gasArr.length : 0
  const avgO2    = gasArr.length ? gasArr.reduce((s,g) => s + (g.o2_percent || 20.9), 0) / gasArr.length : 20.9

  // Per-responder latest vitals for bar chart
  const vitalsBar = responders.map(r => {
    const v = liveVitals[r.badge_id] || {}
    return {
      name: r.name.split(' ')[0],
      HR: v.heart_rate ? Number(v.heart_rate).toFixed(0) : 0,
      SpO2: v.spo2 ? Number(v.spo2).toFixed(1) : 0,
    }
  })

  const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#22c55e','#06b6d4']

  return (
    <div className="flex flex-col gap-4 p-5 min-h-full bg-dash-bg">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-brand" />
            Analytics
          </h1>
          <p className="text-slate-500 text-[10px] mt-0.5">Aggregated health & environment metrics</p>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          {new Date().toLocaleTimeString()} — Live
        </span>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        <StatPill icon={<HeartPulse size={11} className="text-hr" />}
          label="Avg Heart Rate" value={`${avgHR.toFixed(0)} bpm`}
          delta={avgHR > 100 ? 8.5 : null} color="#f43f5e" />
        <StatPill icon={<Droplets size={11} className="text-spo2" />}
          label="Avg SpO2" value={`${avgSpO2.toFixed(1)}%`}
          delta={avgSpO2 < 96 ? -2.1 : null} color="#06b6d4" />
        <StatPill icon={<Thermometer size={11} className="text-temp" />}
          label="Avg Body Temp" value={`${avgTemp.toFixed(1)}°C`}
          delta={null} color="#fb923c" />
        <StatPill icon={<Wind size={11} className="text-co" />}
          label="Avg CO Exposure" value={`${avgCO.toFixed(1)} ppm`}
          delta={avgCO > 10 ? 3.2 : null} color="#a78bfa" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* HR trend - first responder */}
        <Card title="Heart Rate Trend (Primary Responder)">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={firstHist} margin={{ top:5, right:5, bottom:0, left:-25 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize:8, fill:'#475569' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8, fill:'#475569' }} domain={['auto','auto']} />
                <Tooltip contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="hr" stroke="#f43f5e" fill="url(#hrGrad)" strokeWidth={1.5} dot={false} connectNulls name="HR (bpm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* SpO2 trend */}
        <Card title="SpO₂ Trend (Primary Responder)">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={firstHist} margin={{ top:5, right:5, bottom:0, left:-25 }}>
                <defs>
                  <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize:8, fill:'#475569' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8, fill:'#475569' }} domain={[85, 100]} />
                <Tooltip contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="spo2" stroke="#06b6d4" fill="url(#spo2Grad)" strokeWidth={1.5} dot={false} connectNulls name="SpO2 (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Per-responder HR comparison */}
        <Card title="Per-Responder Heart Rate Comparison">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vitalsBar} margin={{ top:5, right:5, bottom:0, left:-25 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize:9, fill:'#475569' }} />
                <YAxis tick={{ fontSize:8, fill:'#475569' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="HR" fill="#f43f5e" radius={[4,4,0,0]} name="Heart Rate (bpm)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gas exposure chart */}
        <Card title="Current Gas Exposure Levels">
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {[
              { label: 'CO (ppm)',   value: avgCO,  limit: 50,  color: '#a78bfa' },
              { label: 'NO₂ (ppm)', value: avgNO2, limit: 5,   color: '#f43f5e' },
              { label: 'O₂ (%)',    value: avgO2,  limit: 25,  color: '#06b6d4' },
            ].map(({ label, value, limit, color }) => {
              const pct   = Math.min((value / limit) * 100, 100)
              const alert = value > limit * 0.8
              return (
                <div key={label}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-mono font-bold ${alert ? 'text-crit' : 'text-slate-300'}`}>
                      {value.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: alert ? '#ef4444' : color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Multi-responder comparison line chart */}
      {responders.length > 1 && allHistData.length > 0 && (
        <Card title="Multi-Responder Heart Rate Comparison" className="col-span-2">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={allHistData} margin={{ top:5, right:10, bottom:0, left:-25 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize:8, fill:'#475569' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8, fill:'#475569' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                {responders.map((r, i) => (
                  <Line key={r.badge_id} type="monotone"
                    dataKey={`hr_${r.badge_id}`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5} dot={false} connectNulls
                    name={r.name.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  )
}
