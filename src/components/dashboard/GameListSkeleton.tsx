import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder cards shaped like the real game banners, shown while the day's
 * fixtures/predictions load — steadier than a single centered spinner. */
export function GameListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-border"
        >
          {/* time + competition */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-28" />
          </div>
          {/* teams (crests + names) */}
          <div className="mt-2 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-5" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* probability meter */}
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
          {/* verdict + tier pills */}
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
