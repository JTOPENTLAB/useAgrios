import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Sprout, Video, ShieldCheck } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { EmptyState } from "./FarmerDashboard";
import RatingPill from "@/components/RatingPill";
import DeliveryBadge from "@/components/DeliveryBadge";

export default function FarmerListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/listings/mine")
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6" data-testid="farmer-listings-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">My Listings</h1>
          <p className="text-ink-muted mt-1">All produce you've published on AGRIOS.</p>
        </div>
        <Link
          to="/app/farmer/listings/new"
          className="af-btn-primary"
          data-testid="create-listing-link"
        >
          <PlusCircle className="w-4 h-4" /> New listing
        </Link>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="af-card p-10">
          <EmptyState
            icon={Sprout}
            title="No listings yet"
            text="Start selling on AGRIOS by creating your first crop listing."
            cta={
              <Link to="/app/farmer/listings/new" className="af-btn-primary mt-4">
                <PlusCircle className="w-4 h-4" /> Create listing
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
          {items.map((l) => (
            <div
              key={l.id}
              className="af-card af-card-hover overflow-hidden flex flex-col"
              data-testid={`listing-card-${l.id}`}
            >
              <div className="aspect-[4/3] bg-zinc-100 relative">
                {l.image_url ? (
                  <img
                    src={l.image_url}
                    alt={l.crop}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-ink-muted">
                    <Sprout className="w-10 h-10" />
                  </div>
                )}
                <span className="absolute top-3 right-3 af-badge-verified capitalize">
                  <ShieldCheck className="w-3 h-3" /> {l.status}
                </span>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold text-ink text-lg truncate">
                      {l.crop}
                    </h3>
                    <div className="text-xs text-ink-muted mt-0.5 truncate">
                      {l.variety || "—"} · Grade {l.grade}
                    </div>
                  </div>
                  <span className="af-chip flex-shrink-0">{l.location}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <RatingPill seed={l.id} verified testId={`farmer-rating-${l.id}`} />
                  <DeliveryBadge testId={`farmer-delivery-${l.id}`} />
                </div>

                <div className="mt-4 flex items-center justify-between pt-4 border-t border-zinc-100">
                  <div>
                    <div className="font-heading font-extrabold text-xl text-ink tracking-tight">
                      {fmtMoney(l.price_per_kg, l.currency || "NGN")}
                      <span className="text-sm text-ink-muted font-normal">/kg</span>
                    </div>
                    <div className="text-xs text-ink-muted font-semibold">
                      {Number(l.quantity_kg || 0).toLocaleString()}kg available
                    </div>
                  </div>
                  <div className="font-heading font-bold text-brand text-right">
                    {fmtMoney(l.price_per_kg * l.quantity_kg, l.currency || "NGN")}
                    <div className="text-[10px] text-ink-muted font-normal">inventory value</div>
                  </div>
                </div>

                {/* Promote with Video — deep-link to video script tool pre-filled */}
                <Link
                  to={`/app/farmer/videos?crop=${encodeURIComponent(l.crop)}&listing_id=${l.id}`}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/30 text-gold-dark font-bold text-sm py-2.5 px-4 hover:from-gold/25 hover:to-gold/10 transition"
                  data-testid={`promote-video-${l.id}`}
                >
                  <Video className="w-4 h-4" /> Promote with Video
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
