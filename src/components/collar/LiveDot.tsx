import { cn } from "@/lib/utils";

/** The amber "live" pulse — the same signal as the live marker on the collar map. */
export default function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 flex-shrink-0", className)} aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full bg-amber opacity-60" />
      <span className="relative inline-flex h-full w-full rounded-full bg-amber" />
    </span>
  );
}
