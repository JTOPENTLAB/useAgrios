import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Sprout, ShieldCheck } from "lucide-react";
import api, { fmtNGN } from "@/lib/api";

export default function BuyerMarketplace() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [location, setLocation] = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (grade) params.grade = grade;
    if (location) params.location = location;
    api.get("/listings", { params }).then((r) => setItems(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line

  return (
    <div className="space-y-6" data-testid="marketplace-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Source</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Marketplace</h1>
        <p className="text-ink-muted mt-1">Verified farmers. Structured listings. Escrow-protected orders.</p>
      </div>

      <div className="af-card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input className="af-input pl-9" placeholder="Search crop, variety, description…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} data-testid="mp-search" />
        </div>
        <input className="af-input sm:max-w-[200px]" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="mp-location" />
        <select className="af-input sm:max-w-[160px]" value={grade} onChange={(e) => setGrade(e.target.value)} data-testid="mp-grade">
          <option value="">All grades</option>
          <option value="A">Grade A</option>
          <option value="B">Grade B</option>
          <option value="C">Grade C</option>
        </select>
        <button onClick={load} className="af-btn-primary" data-testid="mp-filter-btn">Filter</button>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="af-card p-10 text-center">
          <Sprout className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No produce matches</div>
          <div className="text-sm text-ink-muted">Try different filters or clear the search.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
          {items.map((l) => (
            <Link to={`/app/marketplace/${l.id}`} key={l.id} className="af-card af-card-hover overflow-hidden" data-testid={`product-card-${l.id}`}>
              <div className="aspect-[4/3] bg-zinc-100">
                {l.image_url && <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-ink">{l.crop}</h3>
                    <div className="text-xs text-ink-muted mt-0.5">{l.variety || "—"} · Grade {l.grade}</div>
                  </div>
                  {l.farmer_verified && <span className="af-badge-verified"><ShieldCheck className="w-3 h-3" /> Verified</span>}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                  <MapPin className="w-3.5 h-3.5" /> {l.location}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="font-heading font-extrabold text-xl text-ink">{fmtNGN(l.price_per_kg)}<span className="text-sm text-ink-muted font-normal">/kg</span></div>
                    <div className="text-xs text-ink-muted">{l.quantity_kg.toLocaleString()}kg available</div>
                  </div>
                  <span className="af-chip">by {l.farmer_name?.split(" ")[0]}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
