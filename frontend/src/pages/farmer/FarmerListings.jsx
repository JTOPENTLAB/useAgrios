import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Sprout } from "lucide-react";
import api, { fmtNGN } from "@/lib/api";
import { EmptyState } from "./FarmerDashboard";

export default function FarmerListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/listings/mine").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6" data-testid="farmer-listings-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">My Listings</h1>
          <p className="text-ink-muted mt-1">All produce you've published on AGRIOS.</p>
        </div>
        <Link to="/app/farmer/listings/new" className="af-btn-primary" data-testid="create-listing-link">
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
            cta={<Link to="/app/farmer/listings/new" className="af-btn-primary mt-4"><PlusCircle className="w-4 h-4" /> Create listing</Link>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
          {items.map((l) => (
            <div key={l.id} className="af-card af-card-hover overflow-hidden" data-testid={`listing-card-${l.id}`}>
              <div className="aspect-[4/3] bg-zinc-100 relative">
                {l.image_url ? (
                  <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-ink-muted"><Sprout className="w-10 h-10" /></div>
                )}
                <span className="absolute top-3 right-3 af-badge-verified">{l.status}</span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-ink text-lg">{l.crop}</h3>
                    <div className="text-xs text-ink-muted mt-0.5">{l.variety || "—"} · Grade {l.grade}</div>
                  </div>
                  <span className="af-chip">{l.location}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="font-heading font-extrabold text-xl text-ink">{fmtNGN(l.price_per_kg)}<span className="text-sm text-ink-muted font-normal">/kg</span></div>
                    <div className="text-xs text-ink-muted">{l.quantity_kg.toLocaleString()}kg available</div>
                  </div>
                  <div className="font-heading font-bold text-brand">{fmtNGN(l.price_per_kg * l.quantity_kg)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
