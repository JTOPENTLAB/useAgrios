import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sprout,
  ShoppingBag,
  Wallet as WalletIcon,
  TrendingUp,
  PlusCircle,
  Sparkles,
  Gift,
  Copy,
  ArrowRight,
  Lock,
  Shield,
  Bell,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import StatCard from "@/components/StatCard";
import TrustStrip from "@/components/TrustStrip";
import HotDemandStrip from "@/components/HotDemandStrip";
import FarmerPriceGuidance from "@/components/FarmerPriceGuidance";
import SupplierScoreCard from "@/components/SupplierScoreCard";
import { useAuth } from "@/context/AuthContext";

export default function FarmerDashboard() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [offers, setOffers] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/listings/mine").then((r) => setListings(r.data)),
      api.get("/orders").then((r) => setOrders(r.data)),
      api.get("/wallet").then((r) => setWallet(r.data.wallet)),
      api.get("/offers/farmer").then((r) => setOffers(r.data)).catch(() => {}),
      api.get("/notifications").then((r) => {
        const d = r.data;
        setNotifs(Array.isArray(d) ? d : d?.items || []);
      }).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyRef = () => {
    if (user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code);
      toast.success("Referral code copied");
    }
  };

  const activeListings = listings.filter((l) => l.status === "active").length;
  const pendingOffers = offers.filter((o) => o.status === "pending").length;
  const completed = orders.filter((o) => o.status === "completed").length;
  const activeOrders = orders.filter((o) =>
    ["escrow_funded", "in_logistics", "in_transit", "delivered"].includes(o.status)
  ).length;

  // Week window
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const earningsThisWeek = orders
    .filter(
      (o) =>
        o.status === "completed" &&
        new Date(o.completed_at || o.created_at).getTime() >= weekAgo
    )
    .reduce((s, o) => s + (o.farmer_amount || 0), 0);

  const lifetimeEarnings = orders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + (o.farmer_amount || 0), 0);

  const escrowLocked = orders
    .filter((o) => o.escrow_status === "funded")
    .reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="space-y-7" data-testid="farmer-dashboard">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Farmer</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} 🌾
          </h1>
          <p className="text-ink-muted mt-1">
            The operating system for agricultural trade.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/farmer/listings/new" className="af-btn-primary" data-testid="sell-crop-btn">
            <PlusCircle className="w-4 h-4" /> Sell crop
          </Link>
          <Link to="/app/farmer/ai" className="af-btn-secondary">
            <Sparkles className="w-4 h-4" /> AI tools
          </Link>
        </div>
      </div>

      {/* ================= PRIMARY: Wallet + Escrow Hero ================= */}
      <section
        className="rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark text-white p-6 sm:p-8 shadow-lift relative overflow-hidden"
        data-testid="wallet-hero"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70">
            <Shield className="w-3.5 h-3.5" /> Your wallet · Protected by escrow
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mt-3">
            <div>
              <div
                className="font-heading font-extrabold text-5xl sm:text-6xl tracking-tight leading-none"
                data-testid="wallet-balance-hero"
              >
                {loading ? "—" : fmtMoney(wallet?.available || 0, currency)}
              </div>
              <div className="text-white/80 mt-2 text-sm inline-flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Funds protected until delivery is confirmed
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                to="/app/wallet"
                className="inline-flex items-center gap-2 bg-white text-brand font-bold rounded-full px-5 py-3 hover:bg-zinc-50 transition"
                data-testid="wallet-open-btn"
              >
                Open wallet <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/app/orders"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-full px-5 py-3 transition"
                data-testid="orders-open-btn"
              >
                Orders
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-7 pt-6 border-t border-white/10">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">In escrow</div>
              <div className="font-heading font-extrabold text-xl mt-1">
                {loading ? "—" : fmtMoney(escrowLocked, currency)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">Pending payout</div>
              <div className="font-heading font-extrabold text-xl mt-1">
                {loading ? "—" : fmtMoney(wallet?.pending || 0, currency)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">Lifetime</div>
              <div className="font-heading font-extrabold text-xl mt-1">
                {loading ? "—" : fmtMoney(lifetimeEarnings, currency)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECOND: Earnings + Active Orders ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 af-stagger">
        <StatCard
          label="Earnings this week"
          value={loading ? "—" : fmtMoney(earningsThisWeek, currency)}
          sub={`${completed} completed orders`}
          tone="brand"
          testId="stat-earnings-week"
        />
        <StatCard
          label="Active orders"
          value={loading ? "—" : activeOrders}
          sub={activeOrders > 0 ? "In escrow / in transit" : "All caught up"}
          tone="gold"
          testId="stat-active-orders"
        />
        <StatCard
          label="Pending offers"
          value={loading ? "—" : pendingOffers}
          sub={pendingOffers > 0 ? "Waiting on your reply" : "Nothing pending"}
          tone="blue"
          testId="stat-pending-offers"
        />
      </div>

      {/* Supplier performance score + badges (Phase D) */}
      <SupplierScoreCard farmerId={user?.id} />

      {/* Referral card (retained) */}
      {user?.referral_code && (
        <div
          className="af-card p-5 border-l-4 border-l-gold flex flex-col sm:flex-row items-start sm:items-center gap-4"
          data-testid="referral-card"
        >
          <div className="w-11 h-11 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
            <Gift className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-heading font-bold text-ink">Earn ₦5,000 per referral</div>
            <div className="text-xs text-ink-muted mt-1">
              Share your code. When your friend signs up and completes their first order, you both
              earn ₦5,000 wallet credit.
            </div>
          </div>
          <button onClick={copyRef} className="af-btn-accent text-sm" data-testid="copy-referral-btn">
            <Copy className="w-4 h-4" /> {user.referral_code}
          </button>
        </div>
      )}

      {/* ================= MIDDLE: Sell CTA + Active Listings ================= */}
      <section className="af-card p-6" data-testid="listings-section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg text-ink">Active listings</h3>
            <div className="text-xs text-ink-muted">Your produce currently on the marketplace.</div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/app/farmer/listings/new"
              className="af-btn-primary text-sm"
              data-testid="middle-sell-crop"
            >
              <PlusCircle className="w-4 h-4" /> Sell crop
            </Link>
            <Link
              to="/app/farmer/listings"
              className="af-btn-ghost text-sm"
              data-testid="view-all-listings"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        {listings.length === 0 ? (
          <EmptyState
            icon={Sprout}
            title="No listings yet"
            text="Create your first crop listing to get discovered by buyers across Africa."
            cta={
              <Link to="/app/farmer/listings/new" className="af-btn-primary mt-4">
                <PlusCircle className="w-4 h-4" /> Create listing
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {listings.slice(0, 5).map((l) => (
              <div
                key={l.id}
                className="py-3 flex items-center gap-4"
                data-testid={`listing-row-${l.id}`}
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden flex-shrink-0">
                  {l.image_url && (
                    <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-bold text-ink truncate">
                    {l.crop}{" "}
                    <span className="text-ink-muted font-normal text-sm">· Grade {l.grade}</span>
                  </div>
                  <div className="text-xs text-ink-muted truncate">
                    {l.location} · {Number(l.quantity_kg).toLocaleString()}kg
                  </div>
                </div>
                <div className="font-heading font-bold text-ink whitespace-nowrap">
                  {fmtMoney(l.price_per_kg, l.currency || currency)}
                  <span className="text-ink-muted font-normal text-xs">/kg</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-ink-muted flex items-center justify-between">
          <span>{activeListings} active · {listings.length} total</span>
          <Link to="/app/farmer/listings" className="text-brand font-semibold">
            Manage listings →
          </Link>
        </div>
      </section>

      {/* ================= BOTTOM: Market Insights + Notifications ================= */}
      <HotDemandStrip />

      {/* Smart suggestions — price guidance + hot crops you're not listing */}
      <FarmerPriceGuidance />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="af-card p-6" data-testid="market-insights">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Market insights</h3>
              <div className="text-xs text-ink-muted">AI pricing &amp; demand guidance</div>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brand mt-2 flex-shrink-0" />
              <div>
                <div className="font-semibold text-ink">Price your tomatoes ≥ ₦450/kg</div>
                <div className="text-xs text-ink-muted">Lagos demand up 42% this week.</div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-dark mt-2 flex-shrink-0" />
              <div>
                <div className="font-semibold text-ink">Cocoa export-grade window open</div>
                <div className="text-xs text-ink-muted">Post early-week for faster funding.</div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <div>
                <div className="font-semibold text-ink">Bulk buyers sourcing maize</div>
                <div className="text-xs text-ink-muted">Grant 10–12% discount on 500kg+.</div>
              </div>
            </li>
          </ul>
          <Link
            to="/app/farmer/ai"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand mt-4"
          >
            Generate AI price recommendation <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="af-card p-6" data-testid="notifications-panel">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-ink">Notifications</h3>
              <div className="text-xs text-ink-muted">Most recent activity on your account</div>
            </div>
            {notifs.filter((n) => !n.read).length > 0 && (
              <span className="af-badge-pending text-[10px]">
                {notifs.filter((n) => !n.read).length} new
              </span>
            )}
          </div>
          {notifs.length === 0 ? (
            <div className="text-sm text-ink-muted py-6 text-center">
              No notifications yet. You'll see order updates and offers here.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {notifs.slice(0, 5).map((n) => (
                <li key={n.id} className="py-2.5 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      n.read ? "bg-zinc-300" : "bg-brand"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-ink">{n.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Inbox quick actions */}
      <div className="af-card p-6" data-testid="inbox-panel">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-ink">Inbox</h3>
          <span className="text-xs text-ink-muted">Quick actions</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <Link
            to="/app/farmer/offers"
            className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-100 hover:border-gold hover:bg-gold/5 transition"
            data-testid="quick-offers"
          >
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-ink">Pending offers</div>
              <div className="text-xs text-ink-muted">
                {pendingOffers} {pendingOffers === 1 ? "buyer waiting" : "buyers waiting"}
              </div>
            </div>
          </Link>
          <Link
            to="/app/orders"
            className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-100 hover:border-brand hover:bg-brand/5 transition"
            data-testid="quick-orders"
          >
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-ink">Active orders</div>
              <div className="text-xs text-ink-muted">{activeOrders} in progress</div>
            </div>
          </Link>
          <Link
            to="/app/wallet"
            className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-100 hover:border-brand hover:bg-brand/5 transition"
            data-testid="quick-wallet"
          >
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <WalletIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-ink">Wallet</div>
              <div className="text-xs text-ink-muted">Open · request payout</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Trust strip at bottom for extra reassurance */}
      <TrustStrip variant="compact" className="justify-center mt-4" testId="farmer-trust-compact" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, cta }) {
  return (
    <div className="py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 grid place-items-center mx-auto mb-4 text-ink-muted">
        <Icon className="w-6 h-6" />
      </div>
      <div className="font-heading font-bold text-ink">{title}</div>
      <div className="text-sm text-ink-muted mt-1 max-w-xs mx-auto">{text}</div>
      {cta}
    </div>
  );
}
