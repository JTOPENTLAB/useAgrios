import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import ProductCard from "./ProductCard";

const KEY = "agrios_recently_viewed_v1";
const MAX_ITEMS = 12;

export function pushRecentlyViewed(listing) {
  if (!listing || !listing.id) return;
  try {
    const now = Date.now();
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    // Dedupe
    const next = [
      { id: listing.id, listing, viewed_at: now },
      ...list.filter((x) => x.id !== listing.id),
    ].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / parse errors — non-fatal */
  }
}

export default function RecentlyViewed({ exclude = [], limit = 4, title = "Recently viewed" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      const excl = new Set(exclude);
      setItems(
        list
          .filter((x) => !excl.has(x.id))
          .slice(0, limit)
          .map((x) => x.listing)
      );
    } catch {
      setItems([]);
    }
  }, [exclude.join(","), limit]); // eslint-disable-line

  if (items.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="recently-viewed">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-zinc-100 text-ink-soft grid place-items-center">
          <Clock className="w-4 h-4" />
        </div>
        <h3 className="font-heading font-bold text-ink">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((l) => (
          <ProductCard
            key={l.id}
            listing={l}
            testIdPrefix="recent-card"
          />
        ))}
      </div>
    </section>
  );
}
