/**
 * Lightweight skeleton primitives for loading states.
 * Keeps zero dependency footprint — uses Tailwind + keyframes already shipping.
 */

export function Skeleton({ className = "", testId }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-zinc-100 ${className}`}
      data-testid={testId}
    />
  );
}

export function CardSkeleton({ rows = 3, className = "" }) {
  return (
    <div className={`af-card p-6 space-y-3 ${className}`}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2 pt-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className = "" }) {
  return (
    <div className={`af-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex items-end gap-2 h-48">
        {[45, 62, 50, 75, 58, 82, 70, 90, 65, 85, 72, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-zinc-100 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
