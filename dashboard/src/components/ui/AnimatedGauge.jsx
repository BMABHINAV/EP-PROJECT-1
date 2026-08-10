import { useEffect, useRef } from 'react'

/**
 * SVG Arc Gauge — animated on mount.
 * value: 0–100
 * color: stroke color
 * size: svg width/height px
 */
export default function AnimatedGauge({ value = 0, color = '#3B82F6', size = 120, label = '', sublabel = '' }) {
  const arcRef = useRef(null)

  const radius = (size / 2) - 12
  const circumference = Math.PI * radius  // half circle arc
  const dashValue = circumference * (1 - value / 100)

  useEffect(() => {
    const el = arcRef.current
    if (!el) return
    // Start at empty, animate to value
    el.style.strokeDashoffset = String(circumference)
    el.style.transition = 'none'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)'
        el.style.strokeDashoffset = String(dashValue)
      })
    })
  }, [value, circumference, dashValue])

  const cx = size / 2
  const cy = size / 2 + 8  // offset center down for half-arc
  const startAngle = Math.PI  // 180°
  const endAngle   = 0        // 0°

  const polarToCartesian = (angle) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  })

  const start = polarToCartesian(startAngle)
  const end   = polarToCartesian(endAngle)
  const trackPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
  const valuePath = trackPath

  // Color by value
  const getColor = () => {
    if (value >= 80) return '#EF4444'
    if (value >= 60) return '#F59E0B'
    if (value >= 30) return color
    return '#22C55E'
  }
  const arcColor = getColor()

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6 + 8}`}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            ref={arcRef}
            d={valuePath}
            fill="none"
            stroke={arcColor}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            style={{ filter: `drop-shadow(0 0 6px ${arcColor})` }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="font-mono font-bold" style={{ fontSize: size * 0.2, color: arcColor }}>
            {Math.round(value)}%
          </span>
          {sublabel && (
            <span className="text-slate-400 font-medium" style={{ fontSize: size * 0.09 }}>
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {label && (
        <div className="text-center text-[9px] uppercase tracking-widest text-slate-500 font-semibold mt-1">
          {label}
        </div>
      )}
    </div>
  )
}
