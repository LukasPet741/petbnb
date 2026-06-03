import { Star } from "lucide-react";

export default function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200"}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-stone-700">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-sm text-stone-400">({count})</span>
      )}
    </div>
  );
}
