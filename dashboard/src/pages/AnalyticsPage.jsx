import { useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { HeartPulse, Droplets, Thermometer, Wind, TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react'
import useStore from '../store/useStore'
import CountUp from '../components/ui/CountUp'

const TT = {
  backgroundColor: 'rgba(6, 12, 24, 0.92)',
  border: '1px solid rgba(59, 130, 246, 0.35)',
  borderRadius: 10,
  fontSize: 11,
  backdropFilter: 'blur(12px)',
}

function ChartCard({ title, accent='#3B82F6', children, className='' }) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-3 ${className}`}
      style={{ background:'rgba(10, 18, 34, 0.78)', border:'1px solid rgba(59,130,246,0.22)', backdropFilter:'blur(16px)', boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-4 rounded-full" style={{ background:accent, boxShadow:`0 0 8px ${accent}` }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">{title}</span>
      </div>
      {children}
    </div>
  )
}

function StatPill({ icon, label, value, delta, color }) {
  const up = delta >= 0
  return (
    <div className="flex-1 rounded-xl px-3 py-3 transition-all hover:-translate-y-0.5"
      style={{ background:'rgba(10, 18, 34, 0.78)', border:'1px solid rgba(59,130,246,0.22)', backdropFilter:'blur(16px)', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mb-2 uppercase tracking-widest">
        <span style={{ color }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-xl font-bold" style={{ color, textShadow:`0 0 8px ${color}60` }}>{value}</span>
        {delta!=null && (
          <span className={`flex items-center gap-0.5 text-[9px] font-bold ${up?'text-crit':'text-safe'}`}>
            {up ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { responders, history, liveVitals, liveGas } = useStore()

  const allHistData = useMemo(() => {
    const byTime = {}
    responders.forEach(r => {
      const h = history[r.badge_id] || history[r.id] || []
      h.forEach(d => {
        if (!byTime[d.time]) byTime[d.time] = { time:d.time }
        if (d.hr)   byTime[d.time][`hr_${r.badge_id}`]   = Number(d.hr).toFixed(0)
        if (d.spo2) byTime[d.time][`spo2_${r.badge_id}`] = Number(d.spo2).toFixed(1)
      })
    })
    return Object.values(byTime).sort((a,b)=>a.time?.localeCompare(b.time)).slice(-30)
  }, [responders, history])

  const firstR    = responders[0]
  const firstHist = firstR ? (history[firstR.badge_id] || history[firstR.id] || []).slice(-30) : []

  const liveArr = responders.map(r => liveVitals[r.badge_id]||{})
  const avgHR   = liveArr.length ? liveArr.reduce((s,v)=>s+(v.heart_rate||0),0)/liveArr.length : 0
  const avgSpO2 = liveArr.length ? liveArr.reduce((s,v)=>s+(v.spo2||0),0)/liveArr.length : 0
  const avgTemp = liveArr.length ? liveArr.reduce((s,v)=>s+(v.body_temp_c||0),0)/liveArr.length : 0

  const gasArr = responders.map(r=>liveGas[r.badge_id]||{})
  const avgCO  = gasArr.length ? gasArr.reduce((s,g)=>s+(g.co_ppm||0),0)/gasArr.length : 0
  const avgNO2 = gasArr.length ? gasArr.reduce((s,g)=>s+(g.no2_ppm||0),0)/gasArr.length : 0
  const avgO2  = gasArr.length ? gasArr.reduce((s,g)=>s+(g.o2_percent||20.9),0)/gasArr.length : 20.9

  const vitalsBar = responders.map(r => {
    const v = liveVitals[r.badge_id]||{}
    return { name:r.name.split(' ')[0], HR:v.heart_rate?Number(v.heart_rate).toFixed(0):0, SpO2:v.spo2?Number(v.spo2).toFixed(1):0 }
  })

  const COLORS = ['#3B82F6','#A78BFA','#F59E0B','#EF4444','#22C55E','#06B6D4']

  return (
    <div className="flex flex-col gap-4 p-5 min-h-full animate-fade-scale" style={{ background:'transparent' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={12} className="text-slate-400" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">DATA INTELLIGENCE</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-brand" style={{ filter:'drop-shadow(0 0 6px #3B82F6)' }} /> Analytics
          </h1>
          <p className="text-slate-400 text-[10px] mt-1">Aggregated health & environment metrics — live</p>
        </div>
        <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
          <span className="live-dot" style={{ width:7, height:7 }} /> Live Data
        </span>
      </div>

      <div className="flex gap-3">
        <StatPill icon={<HeartPulse size={10}/>} label="Avg Heart Rate" value={<><CountUp value={avgHR} decimals={0}/> bpm</>} delta={avgHR>100?8.5:null} color="#F43F5E" />
        <StatPill icon={<Droplets size={10}/>}    label="Avg SpO₂"      value={<><CountUp value={avgSpO2} decimals={1}/>%</>}  delta={avgSpO2<96?-2.1:null} color="#06B6D4" />
        <StatPill icon={<Thermometer size={10}/>} label="Avg Temp"      value={<><CountUp value={avgTemp} decimals={1}/>°C</>} delta={null} color="#FB923C" />
        <StatPill icon={<Wind size={10}/>}        label="Avg CO"        value={<><CountUp value={avgCO} decimals={1}/> ppm</>} delta={avgCO>10?3.2:null} color="#A78BFA" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* HR Trend */}
        <ChartCard title="Heart Rate Trend — Primary Responder" accent="#F43F5E">
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
              <AreaChart data={firstHist} margin={{ top:5,right:5,bottom:0,left:-25 }}>
                <defs>
                  <linearGradient id="hrGradD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.00} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize:8,fill:'#64748B' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8,fill:'#64748B' }} domain={['auto','auto']} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="hr" stroke="#F43F5E" fill="url(#hrGradD)" strokeWidth={2} dot={false} connectNulls name="HR (bpm)" style={{ filter:'drop-shadow(0 0 4px #F43F5E)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* SpO2 */}
        <ChartCard title="SpO₂ Trend — Primary Responder" accent="#06B6D4">
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
              <AreaChart data={firstHist} margin={{ top:5,right:5,bottom:0,left:-25 }}>
                <defs>
                  <linearGradient id="spo2GradD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.00} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize:8,fill:'#64748B' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8,fill:'#64748B' }} domain={[85,100]} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="spo2" stroke="#06B6D4" fill="url(#spo2GradD)" strokeWidth={2} dot={false} connectNulls name="SpO₂ (%)" style={{ filter:'drop-shadow(0 0 4px #06B6D4)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* HR Bar */}
        <ChartCard title="Per-Responder Heart Rate" accent="#F59E0B">
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
              <BarChart data={vitalsBar} margin={{ top:5,right:5,bottom:0,left:-25 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize:9,fill:'#64748B' }} />
                <YAxis tick={{ fontSize:8,fill:'#64748B' }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="HR" fill="#F43F5E" radius={[6,6,0,0]} name="Heart Rate (bpm)" style={{ filter:'drop-shadow(0 0 6px rgba(244,63,94,0.4))' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Gas */}
        <ChartCard title="Current Gas Exposure Levels" accent="#A78BFA">
          <div className="flex flex-col gap-3.5 flex-1 justify-center py-2">
            {[
              { label:'CO  (ppm)', value:avgCO,  limit:50,  color:'#A78BFA' },
              { label:'NO₂ (ppm)', value:avgNO2, limit:5,   color:'#F43F5E' },
              { label:'O₂  (%)',   value:avgO2,  limit:25,  color:'#06B6D4' },
            ].map(({ label, value, limit, color }) => {
              const pct=Math.min((value/limit)*100,100); const danger=value>limit*0.8
              return (
                <div key={label}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-slate-400 font-mono">{label}</span>
                    <span className="font-mono font-bold" style={{ color:danger?'#EF4444':color }}>{value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${pct}%`, background:danger?'#EF4444':color, boxShadow:`0 0 8px ${color}` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </div>

      {responders.length>1 && allHistData.length>0 && (
        <ChartCard title="Multi-Responder Heart Rate Comparison" accent="#3B82F6">
          <div style={{ height:200 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
              <LineChart data={allHistData} margin={{ top:5,right:10,bottom:0,left:-25 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize:8,fill:'#64748B' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:8,fill:'#64748B' }} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize:10,paddingTop:8 }} />
                {responders.map((r,i) => (
                  <Line key={r.badge_id} type="monotone" dataKey={`hr_${r.badge_id}`}
                    stroke={COLORS[i%COLORS.length]} strokeWidth={1.5} dot={false} connectNulls name={r.name.split(' ')[0]}
                    style={{ filter:`drop-shadow(0 0 3px ${COLORS[i%COLORS.length]})` }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
