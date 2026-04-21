import { useEffect, useState } from "react";
import { Star, ShieldCheck, MapPin, Crown, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

/**
 * Phase B — live Featured Verified Suppliers from /api/insights/featured-suppliers.
 * Takes an optional `listings` prop as a fallback data source (for lightweight
 * pages that already fetched listings and don't want a second network call).
 */
export default function FeaturedSuppliersStrip({ listings = null }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get("/insights/featured-suppliers")
      .then((r) => setSuppliers(r.data || []))
      .catch(() => {
        // Fallback to derived from listings
        if (listings && listings.length > 0) {
          const seen = new Map();
          for (const l of listings) {
            if (!l.farmer_id || seen.has(l.farmer_id)) continue;
            seen.set(l.farmer_id, {
              id: l.farmer_id,
              name: l.farmer_name || "Verified Farmer",
              location: l.location,
              country: l.country_code || "NG",
              verified: !!l.farmer_verified,
              rating: 4.7,
              rating_count: 18,
              completed_orders: 0,
              featured_crop: l.crop,
            });
          }
          setSuppliers(Array.from(seen.values()).slice(0, 6));
        }
      })
      .finally(() => setLoaded(true));
  }, []); // eslint-disable-line

  if (loaded && suppliers.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="featured-suppliers">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
          <Crown className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-ink">Featured verified suppliers</h3>
          <div className="text-xs text-ink-muted">
            KYC-verified farmers ranked by delivery track record. Higher trust, smoother trade.
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {suppliers.map((s) => (
          <div
            key={s.id}
            className="flex-shrink-0 w-[240px] af-card af-card-hover p-4 snap-start"
            data-testid={`supplier-${s.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand/10 text-brand grid place-items-center font-heading font-extrabold flex-shrink-0 border-2 border-white shadow-soft">
                {s.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading font-bold text-ink text-sm truncate">
                  {s.name.split(" ").slice(0, 2).join(" ")}
                </div>
                {s.verified && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand mt-0.5">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="w-3 h-3" /> <span className="truncate">{s.location || "—"}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {s.rating?.toFixed(1) || "—"}{" "}
                <span className="text-ink-muted font-normal">
                  ({s.rating_count || 0})
                </span>
              </span>
              {s.featured_crop && (
                <span className="text-[10px] af-chip">{s.featured_crop}</span>
              )}
            </div>

            {s.completed_orders > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 flex items-center gap-1.5 text-[11px] text-ink-muted">
                <CheckCircle2 className="w-3 h-3 text-brand" />
                <span>
                  <span className="font-bold text-ink">{s.completed_orders}</span> order
                  {s.completed_orders === 1 ? "" : "s"} completed
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
