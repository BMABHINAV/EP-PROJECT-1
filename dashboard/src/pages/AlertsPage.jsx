import { useState } from 'react'
import { BellRing, CheckCircle, Eye, ShieldAlert } from 'lucide-react'
import useStore from '../store/useStore'
import { acknowledgeAlert } from '../services/api'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

const SEV_STYLE = {
  critical: { badge: 'bg-status-critical/10 text-status-critical border-status-critical/30', dot: 'bg-status-critical' },
  warning:  { badge: 'bg-status-warning/10 text-status-warning border-status-warning/30',   dot: 'bg-status-warning' },
  info:     { badge: 'bg-brand/10 text-brand border-brand/30',                              dot: 'bg-brand' },
}

export default function AlertsPage() {
  const { alerts, acknowledgeAlert: ackLocal } = useStore()
  const [filter, setFilter] = useState('all')

  const filtered = alerts
    .filter(a => filter === 'all' || a.severity === filter)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  async function handleAck(id) {
    try { await acknowledgeAlert(id); ackLocal(id) }
    catch (e) { console.error(e) }
  }

  const unacked = filtered.filter(a => !a.acknowledged).length

  return (
    <div className="flex flex-col gap-5 p-6 min-h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BellRing size={20} className="text-status-caution" />
            Alert Log
          </h1>
          <p className="text-slate-500 text-xs mt-1">{unacked} unacknowledged · {filtered.length} total</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 p-1 bg-bg-card rounded-lg border border-border">
          {['all', 'critical', 'warning', 'info'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize
                ${filter === f
                  ? 'bg-brand text-white shadow-glow-blue'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {['Severity', 'Type', 'Message', 'Time', 'RRI', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <CheckCircle size={22} className="text-status-normal" />
                    <span className="text-sm">No alerts match this filter</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map(alert => {
              const s = SEV_STYLE[alert.severity] || SEV_STYLE.info
              return (
                <tr
                  key={alert.id}
                  className={`border-b border-border transition-colors hover:bg-white/[0.02] ${alert.acknowledged ? 'opacity-40' : ''}`}
                >
                  {/* Severity */}
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase w-fit ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {alert.severity}
                    </span>
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3 font-mono text-slate-300 font-medium">
                    {alert.alert_type?.replace(/_/g, ' ')}
                  </td>
                  {/* Message */}
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{alert.message}</td>
                  {/* Time */}
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {alert.time ? new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}
                  </td>
                  {/* RRI */}
                  <td className="px-4 py-3 font-mono text-brand">
                    {alert.rri_at_alert != null ? `${(alert.rri_at_alert * 100).toFixed(1)}%` : '--'}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    {alert.resolved
                      ? <span className="flex items-center gap-1 text-status-normal"><CheckCircle size={11} />Resolved</span>
                      : alert.acknowledged
                      ? <span className="flex items-center gap-1 text-status-caution"><Eye size={11} />Acknowledged</span>
                      : <span className="flex items-center gap-1 text-status-critical"><ShieldAlert size={11} />Active</span>
                    }
                  </td>
                  {/* Action */}
                  <td className="px-4 py-3">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAck(alert.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border text-slate-400
                                   hover:border-border-light hover:text-white hover:bg-white/5 transition-all"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
