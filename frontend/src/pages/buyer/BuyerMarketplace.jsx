import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sprout, Crown, Flame, Eye } from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProductCard from "@/components/ProductCard";
import TrustStrip from "@/components/TrustStrip";
import HotDemandStrip from "@/components/HotDemandStrip";

export default function BuyerMarketplace() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [trending, setTrending] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (grade) params.grade = grade;
    if (location) params.location = location;
    if (sort) params.sort = sort;
    const loadPromises = [
      api.get("/listings", { params }).then((r) => setItems(r.data)),
      api.get("/listings/trending").then((r) => setTrending(r.data)).catch(() => {}),
    ];
    if (user?.role === "buyer") {
      loadPromises.push(
        api.get("/listings/saved").then((r) => setSavedIds(new Set(r.data.map((x) => x.id)))).catch(() => {})
      );
    }
    Promise.all(loadPromises).finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line

  const toggleSave = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { data } = await api.post(`/listings/${id}/save`);
      const next = new Set(savedIds);
      if (data.saved) next.add(id);
      else next.delete(id);
      setSavedIds(next);
      toast.success(data.saved ? "Saved" : "Unsaved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login as a buyer to save listings");
    }
  };

  return (
    <div className="space-y-6" data-testid="marketplace-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Source</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">Marketplace</h1>
          <p className="text-ink-muted mt-1">Verified farmers. Structured listings. Escrow-protected orders.</p>
        </div>
        {user?.role === "buyer" && (
          user?.subscription_tier && user.subscription_tier !== "basic" ? (
            <span className="af-badge-verified" data-testid="pro-badge">
              <Crown className="w-3 h-3" /> {user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)} · Priority sourcing
            </span>
          ) : (
            <Link to="/app/buyer/plans" className="af-btn-accent py-2 text-sm" data-testid="upgrade-cta">
              <Crown className="w-4 h-4" /> Upgrade to Pro
            </Link>
          )
        )}
      </div>

      <TrustStrip variant="compact" className="justify-center" testId="mp-trust-compact" />

      {/* Phase B — live hot demand banner */}
      <HotDemandStrip compact />

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
        <select className="af-input sm:max-w-[160px]" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="mp-sort">
          <option value="">Newest</option>
          <option value="trending">Most viewed</option>
          <option value="price_low">Price: low to high</option>
          <option value="price_high">Price: high to low</option>
        </select>
        <button onClick={load} className="af-btn-primary" data-testid="mp-filter-btn">Filter</button>
      </div>

      {trending.length > 0 && (
        <div className="af-card p-5" data-testid="trending-strip">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold-dark grid place-items-center"><Flame className="w-4 h-4" /></div>
            <h3 className="font-heading font-bold text-ink">Trending now</h3>
            <span className="af-chip text-[10px]">Most viewed this week</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {trending.slice(0, 6).map((t) => (
              <Link to={`/app/marketplace/${t.id}`} key={t.id} className="rounded-xl overflow-hidden border border-zinc-100 hover:border-brand hover:shadow-soft transition group" data-testid={`trending-${t.id}`}>
                <div className="aspect-square bg-zinc-100 relative">
                  {t.image_url && <img src={t.image_url} alt={t.crop} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                  <span className="absolute bottom-2 left-2 af-chip bg-white/95 text-[10px]"><Eye className="w-3 h-3" /> {t.views || 0}</span>
                </div>
                <div className="p-2">
                  <div className="font-semibold text-ink text-sm truncate">{t.crop}</div>
                  <div className="text-[10px] text-ink-muted">{fmtMoney(t.price_per_kg, t.currency || "NGN")}/kg</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
            <ProductCard
              key={l.id}
              listing={l}
              testIdPrefix="product-card"
              onToggleSave={user?.role === "buyer" ? toggleSave : undefined}
              isSaved={savedIds.has(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
