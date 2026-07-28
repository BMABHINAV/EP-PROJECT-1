import { Users, AlertTriangle, Activity, Download } from 'lucide-react'
import useStore from '../store/useStore'
import ResponderCard from '../components/cards/ResponderCard'
import ResponderDetailModal from '../components/charts/ResponderDetailModal'

export default function RespondersPage() {
  const { responders, liveRRI } = useStore()

  const criticalCount = Object.values(liveRRI).filter(r => r.risk_level === 'critical').length
  const warningCount  = Object.values(liveRRI).filter(r => r.risk_level === 'warning').length

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users size={20} className="text-brand" />
            Field Responders
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {responders.length} units tracked · {criticalCount} critical · {warningCount} warning
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-white/5 border border-border text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <Download size={13} />
          Export CSV
        </button>
      </div>

      {/* Summary mini stats */}
      <div className="flex gap-3">
        {[
          { label: 'Total', value: responders.length, color: 'text-brand' },
          { label: 'Critical', value: criticalCount, color: 'text-status-critical' },
          { label: 'Warning', value: warningCount, color: 'text-status-warning' },
          { label: 'Normal', value: responders.length - criticalCount - warningCount, color: 'text-status-normal' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border">
            <span className="text-slate-500 text-xs">{label}</span>
            <span className={`font-mono font-bold text-sm ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {responders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-card py-24 text-slate-600">
          <Activity size={32} />
          <p className="text-sm">No responders connected yet</p>
          <p className="text-xs text-slate-700">Start the sensor simulator to see live data</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {responders.map(r => <ResponderCard key={r.id} responder={r} />)}
        </div>
      )}

      <ResponderDetailModal />
    </div>
  )
}
