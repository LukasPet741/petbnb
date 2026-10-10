import { cn } from "@/lib/utils";

/**
 * The shape of what is coming, with a slow sheen (plan §2.3): a skeleton, never a
 * "Loading…" line. Size and shape come from className; hidden from screen readers —
 * the region that is loading says so with aria-busy.
 */
export default function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("pb-skeleton block rounded-full", className)} />;
}

/** A card-sized placeholder for lists of sitters, bookings and pets. */
export function SkeletonCard({ media = false, className }: { media?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("glass-card border rounded-[var(--radius-card)] overflow-hidden", className)}>
      {media && <div className="pb-skeleton aspect-[16/10]" />}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
