import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Sprout } from "lucide-react";
import { toast } from "sonner";
import api, { fmtNGN } from "@/lib/api";

export default function SavedListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/listings/saved").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const unsave = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/listings/${id}/save`);
      toast.success("Removed from saved");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="saved-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Bookmarks</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Saved listings</h1>
        <p className="text-ink-muted mt-1">Shortlist crops you want to buy — and come back fast.</p>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="af-card p-10 text-center">
          <Bookmark className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No saved listings yet</div>
          <div className="text-sm text-ink-muted">Tap the bookmark on any marketplace card to save it here.</div>
          <Link to="/app/marketplace" className="af-btn-primary mt-4 inline-flex">Browse marketplace →</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
          {items.map((l) => (
            <Link to={`/app/marketplace/${l.id}`} key={l.id} className="af-card af-card-hover overflow-hidden relative" data-testid={`saved-${l.id}`}>
              <button onClick={(e) => unsave(l.id, e)} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-sm grid place-items-center" data-testid={`unsave-${l.id}`}>
                <Bookmark className="w-4 h-4 text-brand fill-brand" />
              </button>
              <div className="aspect-[4/3] bg-zinc-100">
                {l.image_url ? (
                  <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-ink-muted"><Sprout className="w-10 h-10" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="font-heading font-bold text-ink">{l.crop}</div>
                <div className="text-xs text-ink-muted">{l.location} · Grade {l.grade}</div>
                <div className="mt-3 font-heading font-extrabold text-xl text-brand">{fmtNGN(l.price_per_kg)}<span className="text-sm text-ink-muted font-normal">/kg</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
