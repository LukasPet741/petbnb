import type { ReactNode } from "react";

/** The glass card at the foot of the map for every state that is not "live": what happened, what next. */
export default function StateCard({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="glass-panel absolute inset-x-3 bottom-3 z-[800] rounded-[14px] border px-4 py-3.5 sm:left-4 sm:right-auto sm:w-[360px]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}
