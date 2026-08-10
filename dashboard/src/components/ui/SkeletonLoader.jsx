/**
 * Shimmer skeleton loader for placeholder content.
 * Usage: <SkeletonLoader lines={3} />
 */
export default function SkeletonLoader({ lines = 1, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3 rounded"
          style={{ width: i % 2 === 0 ? '100%' : `${65 + (i % 3) * 10}%` }}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton card placeholder
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`glass-card p-4 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="skeleton w-8 h-8 rounded-full" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-2 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton h-2 rounded" />
      <div className="grid grid-cols-2 gap-2">
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
        <div className="skeleton h-8 rounded-lg" />
      </div>
    </div>
  )
}
