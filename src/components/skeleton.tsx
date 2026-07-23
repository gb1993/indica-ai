export function Skeleton({ className = "h-6 w-full" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-(--surface-muted) ${className}`} />;
}
