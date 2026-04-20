import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sprout, ShoppingBag, Wallet, TrendingUp, PlusCircle, Sparkles, Gift, Copy } from "lucide-react";
import api, { fmtNGN } from "@/lib/api";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/listings/mine").then((r) => setListings(r.data)),
      api.get("/orders").then((r) => setOrders(r.data)),
      api.get("/wallet").then((r) => setWallet(r.data.wallet)),
      api.get("/offers/farmer").then((r) => setOffers(r.data)),
    ]).catch(() => {});
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
  const earnings = orders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + (o.farmer_amount || 0), 0);

  return (
    <div className="space-y-6" data-testid="farmer-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Farmer</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">Good to see you back 🌾</h1>
          <p className="text-ink-muted mt-1">Here's what's moving on your farm today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/farmer/listings/new" className="af-btn-primary" data-testid="new-listing-btn">
            <PlusCircle className="w-4 h-4" /> New listing
          </Link>
          <Link to="/app/farmer/ai" className="af-btn-secondary">
            <Sparkles className="w-4 h-4" /> AI tools
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 af-stagger">
        <StatCard label="Wallet available" value={fmtNGN(wallet?.available)} sub="Ready to payout" tone="brand" testId="stat-wallet-available" />
        <StatCard label="In escrow" value={fmtNGN(orders.filter(o => o.escrow_status === 'funded').reduce((s,o)=>s+o.total,0))} sub={`${orders.filter(o=>o.escrow_status==='funded').length} active orders`} tone="gold" />
        <StatCard label="Active listings" value={activeListings} sub={`${listings.length} total`} tone="blue" />
        <StatCard label="Lifetime earnings" value={fmtNGN(earnings)} sub={`${completed} completed`} tone="zinc" />
      </div>

      {user?.referral_code && (
        <div className="af-card p-5 border-l-4 border-l-gold flex flex-col sm:flex-row items-start sm:items-center gap-4" data-testid="referral-card">
          <div className="w-11 h-11 rounded-xl bg-gold/10 text-gold-dark grid place-items-center"><Gift className="w-5 h-5" /></div>
          <div className="flex-1">
            <div className="font-heading font-bold text-ink">Earn ₦5,000 per referral</div>
            <div className="text-xs text-ink-muted mt-1">Share your code. When your friend signs up and completes their first order, you both earn ₦5,000 wallet credit.</div>
          </div>
          <button onClick={copyRef} className="af-btn-accent text-sm" data-testid="copy-referral-btn">
            <Copy className="w-4 h-4" /> {user.referral_code}
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="af-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg">Recent listings</h3>
            <Link to="/app/farmer/listings" className="text-sm text-brand font-semibold">View all →</Link>
          </div>
          {listings.length === 0 ? (
            <EmptyState
              icon={Sprout}
              title="No listings yet"
              text="Create your first crop listing to get discovered by buyers."
              cta={<Link to="/app/farmer/listings/new" className="af-btn-primary mt-4"><PlusCircle className="w-4 h-4" /> Create listing</Link>}
            />
          ) : (
            <div className="divide-y divide-zinc-100">
              {listings.slice(0, 5).map((l) => (
                <div key={l.id} className="py-3 flex items-center gap-4" data-testid={`listing-row-${l.id}`}>
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden flex-shrink-0">
                    {l.image_url && <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-ink">{l.crop} <span className="text-ink-muted font-normal text-sm">· Grade {l.grade}</span></div>
                    <div className="text-xs text-ink-muted">{l.location} · {l.quantity_kg}kg</div>
                  </div>
                  <div className="font-heading font-bold text-ink">{fmtNGN(l.price_per_kg)}/kg</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="af-card p-6">
          <h3 className="font-heading font-bold text-lg mb-4">Inbox</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/10 text-gold-dark grid place-items-center"><ShoppingBag className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-sm">Pending offers</div>
                  <div className="text-xs text-ink-muted">Buyers waiting on you</div>
                </div>
              </div>
              <span className="af-badge-pending" data-testid="pending-offers-count">{pendingOffers}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center"><TrendingUp className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-sm">Completed orders</div>
                  <div className="text-xs text-ink-muted">Released settlements</div>
                </div>
              </div>
              <span className="af-badge-verified">{completed}</span>
            </div>
            <Link to="/app/wallet" className="block mt-4 af-btn-secondary w-full">
              <Wallet className="w-4 h-4" /> Open wallet
            </Link>
          </div>
        </div>
      </div>
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
