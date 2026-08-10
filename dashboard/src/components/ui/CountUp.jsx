import { useEffect, useRef, useState } from 'react'

/**
 * Animated number that counts up from 0 to `value` on mount.
 * Supports integers and decimals.
 */
export default function CountUp({ value = 0, decimals = 0, duration = 800, suffix = '', className = '' }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = 0
    const end   = Number(value)
    const startTime = performance.now()

    const step = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className={`animate-count-up ${className}`}>
      {display.toFixed(decimals)}{suffix}
    </span>
  )
}
