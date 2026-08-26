import Link from "next/link";
import { MapPin } from "lucide-react";
import Avatar from "./Avatar";
import type { Profile } from "@/lib/types";

export default function SitterMini({ sitter }: { sitter: Profile }) {
  return (
    <Link href={`/browse/${sitter.id}`} className="group flex items-center gap-3 bg-surface rounded-2xl border border-black/5 shadow-sm p-3.5 hover:shadow-md transition-shadow">
      <Avatar name={sitter.full_name} url={sitter.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{sitter.full_name}</div>
        <div className="flex items-center gap-1 text-xs text-ink-soft mt-0.5"><MapPin className="w-3 h-3" />{sitter.city}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-ink">€{sitter.rate_per_hour}</div>
        <div className="text-[10px] text-ink-soft">/ hr</div>
      </div>
    </Link>
  );
}
