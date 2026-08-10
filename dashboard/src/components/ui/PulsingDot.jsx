/**
 * Reusable pulsing status indicator dot.
 * `color` = tailwind color class e.g. 'bg-safe', 'bg-crit'
 * `glow`  = glow color e.g. 'rgba(34,197,94,0.6)'
 * `fast`  = faster pulse for critical
 */
export default function PulsingDot({ color = 'bg-safe', glow = '', size = 2, fast = false, className = '' }) {
  const sz = `w-${size} h-${size}`
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <span
        className={`absolute rounded-full ${color} opacity-75 ${fast ? 'animate-ping-fast' : 'animate-ping'}`}
        style={{ width: size * 4, height: size * 4, boxShadow: glow ? `0 0 8px ${glow}` : undefined }}
      />
      <span
        className={`relative rounded-full ${color} ${sz}`}
        style={{ boxShadow: glow ? `0 0 6px ${glow}` : undefined }}
      />
    </span>
  )
}
