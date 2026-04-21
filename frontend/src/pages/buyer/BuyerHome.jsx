import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Users,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProductCard from "@/components/ProductCard";
import HotDemandStrip from "@/components/HotDemandStrip";
import FeaturedSuppliersStrip from "@/components/FeaturedSuppliersStrip";
import RecentlyViewed from "@/components/RecentlyViewed";
import TrustStrip from "@/components/TrustStrip";
import StatCard from "@/components/StatCard";

const CURRENCY_SYMBOL = { NGN: "₦", GHS: "₵", KES: "KSh", XOF: "CFA" };

export default function BuyerHome() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const currencySymbol = CURRENCY_SYMBOL[currency] || currency;

  const [listings, setListings] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/listings", { params: { sort: "trending" } }).then((r) => setListings(r.data)),
      api.get("/orders").then((r) => setOrders(r.data)),
      api.get("/listings/saved").then((r) => setSavedIds(new Set(r.data.map((x) => x.id)))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const toggleSave = async (id) => {
    try {
      const { data } = await api.post(`/listings/${id}/save`);
      const next = new Set(savedIds);
      if (data.saved) next.add(id);
      else next.delete(id);
      setSavedIds(next);
      toast.success(data.saved ? "Saved" : "Unsaved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  // Derived stats
  const stats = useMemo(() => {
    const totalSpend = orders
      .filter((o) => ["escrow_funded", "in_logistics", "in_transit", "delivered", "completed"].includes(o.status))
      .reduce((s, o) => s + (o.total || 0), 0);
    const active = orders.filter(
      (o) => !["completed", "cancelled", "refunded"].includes(o.status)
    ).length;
    return { totalSpend, active };
  }, [orders]);

  // Saved suppliers: unique farmer_ids from saved listings
  const savedSuppliers = useMemo(() => {
    const farmers = new Set();
    listings.filter((l) => savedIds.has(l.id)).forEach((l) => l.farmer_id && farmers.add(l.farmer_id));
    return farmers.size;
  }, [listings, savedIds]);

  const feed = listings.slice(0, 6);

  return (
    <div className="space-y-7" data-testid="buyer-home">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Buyer</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-ink-muted mt-1">
            The operating system for agricultural trade.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/marketplace" className="af-btn-primary" data-testid="home-cta-marketplace">
            <ShoppingCart className="w-4 h-4" /> Browse marketplace
          </Link>
          <Link to="/app/wallet" className="af-btn-secondary" data-testid="home-cta-wallet">
            <WalletIcon className="w-4 h-4" /> Wallet
          </Link>
        </div>
      </div>

      {/* Trust strip */}
      <TrustStrip testId="home-trust-strip" />

      {/* Market Pulse promo — drive discovery of digest */}
      <Link
        to="/app/digest"
        className="af-card af-card-hover p-5 flex items-center gap-4 border-l-4 border-l-gold bg-gradient-to-br from-gold/5 to-white"
        data-testid="market-pulse-promo"
      >
        <div className="w-12 h-12 rounded-2xl bg-gold/15 text-gold-dark grid place-items-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-ink">
            📬 Get the AGRIOS Market Pulse every Monday
          </div>
          <div className="text-xs text-ink-muted mt-0.5">
            Top crops · price ranges · new verified suppliers — personalised for you. One-tap
            WhatsApp share.
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-ink-muted" />
      </Link>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 af-stagger">
        <StatCard
          label="Total spend"
          value={loading ? `${currencySymbol}—` : fmtMoney(stats.totalSpend, currency)}
          sub={`${orders.length} order${orders.length === 1 ? "" : "s"} on record`}
          tone="brand"
          testId="stat-total-spend"
        />
        <StatCard
          label="Active orders"
          value={loading ? "—" : String(stats.active)}
          sub={stats.active > 0 ? "Being sourced / delivered" : "None right now"}
          tone="gold"
          testId="stat-active-orders"
        />
        <StatCard
          label="Saved suppliers"
          value={loading ? "—" : String(savedSuppliers)}
          sub={`${savedIds.size} saved listing${savedIds.size === 1 ? "" : "s"}`}
          tone="blue"
          testId="stat-saved-suppliers"
        />
      </div>

      {/* Hot demand */}
      <HotDemandStrip />

      {/* Featured Suppliers */}
      <FeaturedSuppliersStrip listings={listings} />

      {/* Recently viewed — localStorage-based, zero network */}
      <RecentlyViewed limit={4} />

      {/* Marketplace feed */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">Discover</div>
            <h2 className="font-heading font-extrabold text-2xl text-ink">Fresh on the marketplace</h2>
          </div>
          <Link
            to="/app/marketplace"
            className="text-sm font-semibold text-brand inline-flex items-center gap-1"
            data-testid="home-view-all-link"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="af-card p-10 text-center text-ink-muted">Loading fresh supply…</div>
        ) : feed.length === 0 ? (
          <div className="af-card p-10 text-center text-ink-muted">
            No listings available yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 af-stagger">
            {feed.map((l) => (
              <ProductCard
                key={l.id}
                listing={l}
                testIdPrefix="home-card"
                onToggleSave={toggleSave}
                isSaved={savedIds.has(l.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Market Insights */}
      <section className="grid lg:grid-cols-2 gap-5">
        <div className="af-card p-6" data-testid="insights-trending">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Trending crops</h3>
              <div className="text-xs text-ink-muted">Most viewed across AGRIOS this week</div>
            </div>
          </div>
          <div className="space-y-2">
            {listings.slice(0, 5).map((l, i) => (
              <Link
                to={`/app/marketplace/${l.id}`}
                key={l.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition"
              >
                <span className="w-6 h-6 rounded-full bg-zinc-100 text-ink-muted grid place-items-center text-[11px] font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink truncate">{l.crop}</div>
                  <div className="text-[11px] text-ink-muted truncate">{l.location} · Grade {l.grade}</div>
                </div>
                <div className="font-heading font-bold text-sm text-ink">
                  {fmtMoney(l.price_per_kg, l.currency || "NGN")}
                  <span className="text-ink-muted font-normal text-[10px]">/kg</span>
                </div>
              </Link>
            ))}
            {listings.length === 0 && (
              <div className="text-sm text-ink-muted py-6 text-center">No trending data yet.</div>
            )}
          </div>
        </div>

        <div className="af-card p-6" data-testid="insights-signals">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Demand signals</h3>
              <div className="text-xs text-ink-muted">AI-derived buying recommendations</div>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              { t: "Lock in tomato supply", d: "Rainfall low in Ogun — prices projected +8% next week." },
              { t: "Cocoa export window open", d: "Port congestion easing; cocoa grade-A trending up 28%." },
              { t: "Bulk discount available", d: "Farmers in Benue offering 12%+ on 500kg+ maize orders." },
            ].map((s) => (
              <li key={s.t} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-ink">{s.t}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{s.d}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/app/analytics"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand mt-4"
          >
            Open analytics <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Recent Orders teaser */}
      {orders.length > 0 && (
        <section className="af-card p-6" data-testid="recent-orders-teaser">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-ink">Your recent orders</h3>
                <div className="text-xs text-ink-muted">Pick up where you left off</div>
              </div>
            </div>
            <Link
              to="/app/orders"
              className="text-sm font-semibold text-brand inline-flex items-center gap-1"
            >
              All orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {orders.slice(0, 4).map((o) => (
              <Link
                to={`/app/orders/${o.id}`}
                key={o.id}
                className="py-3 flex items-center gap-4 hover:bg-zinc-50 -mx-2 px-2 rounded-xl transition"
                data-testid={`recent-order-${o.id}`}
              >
                <div className="w-10 h-10 rounded-xl bg-zinc-100 grid place-items-center text-ink-muted flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink truncate">
                    {o.crop} · {o.quantity_kg}kg
                  </div>
                  <div className="text-[11px] text-ink-muted truncate">
                    {o.farmer_name} · {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="af-chip capitalize text-[10px]">{o.status.replace(/_/g, " ")}</span>
                <div className="font-heading font-bold text-sm text-ink whitespace-nowrap hidden sm:block">
                  {fmtMoney(o.total, o.currency || "NGN")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
