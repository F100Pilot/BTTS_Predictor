import { cn } from '@/lib/utils';

/** A pulsing placeholder block used to build loading skeletons. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}
