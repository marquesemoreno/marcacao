import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  rating,
  reviewCount,
  className,
}: {
  rating: number;
  reviewCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {typeof reviewCount === "number" && (
        <span className="text-sm text-muted-foreground">({reviewCount})</span>
      )}
    </div>
  );
}
