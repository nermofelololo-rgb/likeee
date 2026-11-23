import { Link } from "@tanstack/react-router";
import { MapPin, Star } from "lucide-react";
import { conditionLabel, formatPrice, intentLabel, timeAgo, type ListingCard } from "@/lib/marketplace/shared";

export function ListingCardView({ item }: { item: ListingCard }) {
  return (
    <Link
      to="/listing/$id"
      params={{ id: item.id }}
      className="flex flex-col overflow-hidden rounded-3xl border border-line bg-card"
    >
      <div className="relative aspect-[4/3] bg-green-soft">
        {item.cover ? (
          <img src={item.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-xs font-semibold text-green">{item.categoryName}</span>
            <span className="text-sm font-bold text-ink">{intentLabel(item.intent)}</span>
          </div>
        )}
        <span className="absolute top-3 start-3 rounded-full bg-card px-2.5 py-1 text-xs font-bold">
          {intentLabel(item.intent)}
        </span>
        {item.featured ? (
          <span className="absolute top-3 end-3 inline-flex items-center gap-1 rounded-full bg-green px-2.5 py-1 text-xs font-bold text-on-green">
            <Star className="size-3" />
            مميز
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug">{item.title}</h3>
        <p className="text-lg font-bold tabular-nums text-amber">{formatPrice(item.price, item.intent)}</p>
        <p className="mt-auto flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" />
          {item.city}
          <span aria-hidden="true">·</span>
          {conditionLabel(item.condition)}
          <span aria-hidden="true">·</span>
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </Link>
  );
}
