export const RISK_BANDS = {
  normal:   { min: 0.0, max: 0.3, color: '#22C55E', label: 'SAFE',     bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.35)' },
  caution:  { min: 0.3, max: 0.6, color: '#F59E0B', label: 'CAUTION',  bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)' },
  warning:  { min: 0.6, max: 0.8, color: '#F97316', label: 'WARNING',  bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.35)' },
  critical: { min: 0.8, max: 1.0, color: '#EF4444', label: 'CRITICAL', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)' },
}

export const RRI_GRADIENT = 'linear-gradient(90deg, #22C55E 0%, #F59E0B 45%, #F97316 68%, #EF4444 100%)'

export function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function riskLevelFromRri(rri = 0) {
  const v = clamp01(rri)
  if (v >= 0.8) return 'critical'
  if (v >= 0.6) return 'warning'
  if (v >= 0.3) return 'caution'
  return 'normal'
}

export function riskMeta(levelOrRri) {
  const level = typeof levelOrRri === 'number' ? riskLevelFromRri(levelOrRri) : (levelOrRri || 'normal')
  return RISK_BANDS[level] || RISK_BANDS.normal
}

export function riskColor(rri = 0) {
  const v = clamp01(rri)
  const stops = [
    [0.00, [34, 197, 94]],
    [0.45, [245, 158, 11]],
    [0.68, [249, 115, 22]],
    [1.00, [239, 68, 68]],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [aPos, a] = stops[i]
    const [bPos, b] = stops[i + 1]
    if (v >= aPos && v <= bPos) {
      const t = (v - aPos) / (bPos - aPos)
      const rgb = a.map((av, idx) => Math.round(av + (b[idx] - av) * t))
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
    }
  }
  return '#EF4444'
}

export function responderRiskValue(responder, liveRRI = {}) {
  const data = liveRRI[responder?.badge_id] || liveRRI[responder?.id] || {}
  return clamp01(data.rri ?? 0)
}

export function sortRespondersByRisk(responders = [], liveRRI = {}) {
  return [...responders].sort((a, b) => {
    const br = responderRiskValue(b, liveRRI)
    const ar = responderRiskValue(a, liveRRI)
    if (br !== ar) return br - ar
    return String(a.team || '').localeCompare(String(b.team || '')) || String(a.name || '').localeCompare(String(b.name || ''))
  })
}

export function rriPercent(rri = 0, decimals = 0) {
  return (clamp01(rri) * 100).toFixed(decimals)
}
