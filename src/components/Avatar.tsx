import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-2xl",
};

const COLORS = [
  "bg-brand-soft text-brand-strong",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

function getColor(name: string) {
  const idx = name.charCodeAt(0) % COLORS.length;
  return COLORS[idx];
}

export default function Avatar({ name, url, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn(
          "rounded-full object-cover ring-1 ring-black/5 flex-shrink-0 bg-surface-2",
          SIZES[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold flex-shrink-0 ring-1 ring-black/5",
        SIZES[size],
        getColor(name),
        className
      )}
    >
      {initials}
    </div>
  );
}
