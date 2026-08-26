import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "brand" | "green" | "amber" | "red" | "blue" | "stone";
  className?: string;
}

const VARIANTS = {
  default: "bg-stone-100 text-stone-700",
  brand: "bg-brand-soft text-brand-strong",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-700",
  stone: "bg-stone-100 text-stone-500",
};

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
