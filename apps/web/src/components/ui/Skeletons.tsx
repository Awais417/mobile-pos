// Shared loading placeholders — keep page structure stable while data loads
// instead of a blank screen or a single centered spinner.

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = 'h-28' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-slate-200 bg-white ${className}`} />;
}
