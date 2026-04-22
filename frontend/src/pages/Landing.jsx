import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
  Wallet,
  Truck,
  Star,
  CheckCircle2,
  Globe,
  LineChart,
  Video,
  Mail,
  Lock,
  Banknote,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Users,
  Package,
  Eye,
  Flame,
} from "lucide-react";
import api, { fmtNGN } from "@/lib/api";
import RecentDealsFeed from "@/components/RecentDealsFeed";
import LandingPulseTicker from "@/components/LandingPulseTicker";
import TestimonialsRail from "@/components/TestimonialsRail";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const HERO_IMG =
  "https://images.unsplash.com/photo-1596788068873-9ffd5cacd4c4?auto=format&fit=crop&w=1536&q=80";

function useCountUp(target, durationMs = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return setVal(0);
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const progress = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

function LiveStatsStrip() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const load = () =>
      api.get("/stats/public").then((r) => setStats(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  const gmv = useCountUp(stats?.gmv_week_ngn || 0);
  const orders = useCountUp(stats?.orders_week || 0);
  const farmers = useCountUp(stats?.active_farmers || 0);
  const countries = useCountUp(stats?.countries_live || 0);
  if (!stats) return null;
  return (
    <div
      className="af-card p-5 flex flex-wrap items-center gap-6 bg-gradient-to-br from-white to-zinc-50 border-l-4 border-l-brand"
      data-testid="live-stats-strip"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
        </span>
        Live on AGRIOS
      </div>
      <Stat label="Traded this week" value={fmtNGN(gmv)} testId="live-gmv" />
      <Stat
        label="Orders"
        value={Math.round(orders).toLocaleString()}
        testId="live-orders"
      />
      <Stat
        label="Suppliers onboarded"
        value={Math.round(farmers).toLocaleString()}
        testId="live-farmers"
      />
      <Stat
        label="Countries live"
        value={Math.round(countries)}
        testId="live-countries"
      />
    </div>
  );
}

function EscrowLockedBadge() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const load = () =>
      api.get("/stats/public").then((r) => setStats(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const amt = useCountUp(stats?.escrow_locked_amount || 0);
  const n = useCountUp(stats?.escrow_locked_count || 0);
  if (!stats) return null;
  return (
    <div
      className="inline-flex items-center gap-3 rounded-2xl border-2 border-brand/20 bg-white/90 backdrop-blur px-4 py-3 shadow-soft"
      data-testid="escrow-locked-badge"
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-5 w-5 rounded-full bg-brand opacity-30 animate-ping" />
        <div className="relative w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
          <Shield className="w-4 h-4" />
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          Live escrow on platform
        </div>
        <div className="font-heading font-extrabold text-lg text-ink">
          {fmtNGN(amt)}{" "}
          <span className="text-ink-muted font-semibold text-sm">
            · {Math.round(n).toLocaleString()} secured order
            {Math.round(n) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div data-testid={testId}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="font-heading font-extrabold text-xl text-ink">
        {value}
      </div>
    </div>
  );
}

export default function Landing() {
  useDocumentMeta({
    title: "AGRIOS — The Operating System for Agricultural Trade",
    description:
      "AGRIOS is the global infrastructure layer for agricultural trade. Marketplace, escrow, wallet, payouts, and market intelligence — in one platform. Launching in Nigeria.",
  });

  return (
    <div
      className="min-h-screen bg-[#FAFAFA] text-ink"
      data-testid="landing-page"
    >
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            data-testid="brand-link"
          >
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">
              AGRIOS
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
            <Link to="/explore" className="hover:text-ink" data-testid="nav-explore-link">
              Explore
            </Link>
            <Link to="/trust" className="hover:text-ink" data-testid="nav-trust-link">
              Trust
            </Link>
            <Link to="/how-it-works" className="hover:text-ink" data-testid="nav-how-link">
              How it works
            </Link>
            <a href="#platform" className="hover:text-ink">
              Platform
            </a>
            <a href="#how" className="hover:text-ink">
              Details
            </a>
            <a href="#intelligence" className="hover:text-ink">
              Intelligence
            </a>
            <a href="#global" className="hover:text-ink">
              Global
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="af-btn-ghost"
              data-testid="nav-login-link"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="af-btn-primary"
              data-testid="nav-signup-link"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============ 1. HERO ============ */}
      <section className="hero-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 lg:pt-24 lg:pb-20">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-7 af-stagger">
              <span className="af-badge-verified" data-testid="hero-badge">
                <Globe className="w-3.5 h-3.5" /> Launching in Nigeria · Built for global agricultural trade
              </span>

              <h1
                className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-ink"
                data-testid="hero-headline"
              >
                The Operating System for{" "}
                <span className="text-brand">Agricultural Trade.</span>
              </h1>

              <p
                className="text-lg text-ink-muted max-w-xl leading-relaxed"
                data-testid="hero-subheadline"
              >
                AGRIOS moves agricultural goods and money with the trust and
                precision of modern financial infrastructure. Global by design.
                Launching in Nigeria.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/signup"
                  className="af-btn-primary"
                  data-testid="hero-cta-primary"
                >
                  Start trading <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/explore"
                  className="af-btn-secondary"
                  data-testid="hero-cta-secondary"
                >
                  Explore the marketplace
                </Link>
              </div>

              <EscrowLockedBadge />

              <LandingPulseTicker />

              <LiveStatsStrip />
            </div>

            <div className="lg:col-span-5 relative">
              <div className="relative rounded-[2rem] overflow-hidden shadow-lift border border-zinc-100">
                <img
                  src={HERO_IMG}
                  alt="Agricultural trade in motion"
                  className="w-full h-[520px] object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 af-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand grid place-items-center text-white font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-ink-muted">
                      Escrow released
                    </div>
                    <div className="font-heading font-bold">
                      Cassava × 2,000kg — Oyo → Lagos
                    </div>
                  </div>
                  <div className="af-badge-verified">Settled</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2. TRUST STRIP ============ */}
      <section className="py-10 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="trust-strip">
            <TrustPill
              icon={Shield}
              title="Escrow on every order"
              sub="Funds held until delivery is confirmed."
            />
            <TrustPill
              icon={CheckCircle2}
              title="Verified suppliers"
              sub="KYC-checked farmers with on-chain track record."
            />
            <TrustPill
              icon={LineChart}
              title="Transparent pricing"
              sub="Real market medians. No middleman markup."
            />
            <TrustPill
              icon={Lock}
              title="Secure payouts"
              sub="Immutable ledger. Bank-grade controls."
            />
          </div>
          <p className="text-center text-sm text-ink-muted mt-6 max-w-2xl mx-auto">
            Every transaction on AGRIOS is protected by the same financial
            primitives that power modern payment rails — built from day one, not
            bolted on.
          </p>
        </div>
      </section>

      {/* Live deal marquee */}
      <RecentDealsFeed />

      {/* Testimonials rail */}
      <TestimonialsRail />

      {/* ============ 3. WHAT AGRIOS DOES ============ */}
      <section id="platform" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              What AGRIOS does
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-ink">
              One platform. The entire trade.
            </h2>
            <p className="mt-4 text-ink-muted text-lg">
              AGRIOS connects farmers and buyers, secures the transaction,
              coordinates delivery, and moves the money. End to end, without
              middlemen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 af-stagger">
            <WhatCard
              icon={Users}
              title="Connect"
              text="Farmers and buyers meet on a single structured marketplace."
            />
            <WhatCard
              icon={Shield}
              title="Secure"
              text="Every trade is ring-fenced in escrow. Money moves only when goods arrive."
            />
            <WhatCard
              icon={Truck}
              title="Deliver"
              text="Verified transporters auto-assigned. Proof-of-delivery built in."
            />
            <WhatCard
              icon={Wallet}
              title="Settle"
              text="Sub-24h payouts to wallet. Immutable ledger. Clean accounting."
            />
          </div>
        </div>
      </section>

      {/* ============ 4. HOW IT WORKS ============ */}
      <section id="how" className="py-20 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
                How a trade flows
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
                Four steps. Zero guesswork.
              </h2>
              <p className="mt-4 text-ink-muted">
                Every trade on AGRIOS moves through the same protected
                pipeline. No chasing payments. No lost shipments.
              </p>
              <ol className="mt-8 space-y-5" data-testid="how-steps">
                {[
                  [
                    "List or discover",
                    "Farmers publish verified produce. Buyers discover structured supply.",
                  ],
                  [
                    "Trade securely",
                    "Buyer funds escrow. Money is locked — not spent.",
                  ],
                  [
                    "Deliver",
                    "Logistics auto-coordinated. Proof-of-delivery uploaded.",
                  ],
                  [
                    "Get paid",
                    "Buyer confirms. Farmer wallet credited in under 24 hours.",
                  ],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-brand text-white grid place-items-center font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-heading font-bold text-ink">
                        {t}
                      </div>
                      <div className="text-ink-muted text-sm mt-1">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="af-card p-6 bg-gradient-to-br from-white to-zinc-50 border-l-4 border-l-gold">
              <div className="text-xs font-bold uppercase tracking-wider text-gold-dark mb-3">
                Live escrow
              </div>
              <div className="font-heading font-bold text-2xl mb-1">
                Order #AG-9241
              </div>
              <div className="text-ink-muted text-sm mb-6">
                Cassava × 2,000kg · Oyo → Lagos
              </div>
              <div className="flex justify-between items-center mb-4">
                {["Funded", "Picked up", "In transit", "Delivered"].map(
                  (s, i) => (
                    <div
                      key={s}
                      className="flex flex-col items-center flex-1"
                    >
                      <div
                        className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${
                          i < 3
                            ? "bg-brand text-white"
                            : "bg-zinc-200 text-ink-muted"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="text-[10px] mt-2 text-ink-muted text-center">
                        {s}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="border-t border-zinc-100 pt-4 flex justify-between text-sm">
                <span className="text-ink-muted">Escrow held</span>
                <span className="font-heading font-bold text-ink">
                  ₦700,000
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-ink-muted">Platform fee (5%)</span>
                <span className="font-bold text-ink">₦35,000</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-ink-muted">Farmer receives</span>
                <span className="font-bold text-brand">₦665,000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 5. MARKET INTELLIGENCE ============ */}
      <section id="intelligence" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
                Market intelligence
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
                The Bloomberg of agricultural trade.
              </h2>
              <p className="mt-4 text-ink-muted text-lg">
                Every trade generates a signal. AGRIOS turns those signals into
                live price trends, demand heatmaps, and weekly market reports
                delivered straight to your inbox.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-soft">
                <li className="flex items-start gap-3">
                  <Flame className="w-4 h-4 text-gold-ink mt-0.5 flex-shrink-0" />
                  <span>
                    <b className="text-ink">Hot demand signals</b> — see which
                    crops are moving and where, in real time.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <LineChart className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>
                    <b className="text-ink">Transparent price trends</b> — real
                    medians from actual orders, not classifieds.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>
                    <b className="text-ink">Market Pulse weekly digest</b> —
                    personalised signals by email and WhatsApp, every Monday.
                  </span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="af-btn-primary mt-8"
                data-testid="intel-cta"
              >
                View Market Pulse <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="lg:col-span-7">
              <div className="af-card p-6 bg-gradient-to-br from-brand/5 via-white to-gold/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                    <LineChart className="w-4 h-4" /> Tomato — Lagos region
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                    +8.2% WoW
                  </span>
                </div>
                <div className="h-36 flex items-end gap-1.5">
                  {[40, 52, 46, 60, 58, 72, 68, 81, 76, 88, 92, 98].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-brand/40"
                        style={{ height: `${h}%` }}
                      />
                    ),
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-zinc-100">
                  <MiniStat label="Active listings" value="34" />
                  <MiniStat label="Median price" value="₦890/kg" />
                  <MiniStat label="Buyers watching" value="27" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 6. FINANCIAL LAYER ============ */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-brand to-brand-dark text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-gold/10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6">
              <div className="text-xs font-bold uppercase tracking-wider text-gold/90 mb-3">
                Financial layer
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl">
                The money rails under every trade.
              </h2>
              <p className="mt-4 text-white/80 text-lg max-w-xl">
                AGRIOS is not a marketplace with payments bolted on. It is a
                financial platform that happens to move crops. Wallets, escrow,
                payouts, and an immutable transaction ledger — all built from
                first principles.
              </p>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <FinPill icon={Wallet} title="Multi-currency wallet" sub="NGN · GHS · KES · XOF" />
                <FinPill icon={Shield} title="Escrow per order" sub="Locked → released on delivery" />
                <FinPill icon={Banknote} title="Fast payouts" sub="Sub-24h settlement" />
                <FinPill icon={LineChart} title="Transparent ledger" sub="Every cent, every step" />
              </div>
              <div className="mt-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-gold/15 text-gold rounded-full px-3 py-2 border border-gold/30">
                <Sprout className="w-3.5 h-3.5" /> Coming soon · Financing, credit lines, buyer pay-later
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-white/10 backdrop-blur border border-white/20 p-6">
                <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Wallet · Adebayo O. · Farmer
                </div>
                <div className="font-heading font-extrabold text-5xl mt-2 tracking-tight">
                  ₦1,845,000
                </div>
                <div className="text-white/60 text-sm mt-1">Available balance</div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <WBox label="In escrow" value="₦420,000" />
                  <WBox label="Pending" value="₦120,000" />
                  <WBox label="Lifetime" value="₦12.4M" />
                </div>
                <div className="mt-6 space-y-2 text-sm">
                  <LedgerRow label="Escrow released · Tomato × 500kg" amount="+₦665,000" positive />
                  <LedgerRow label="Escrow locked · Cassava order" amount="-₦420,000" />
                  <LedgerRow label="Payout · Zenith Bank" amount="-₦300,000" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 7 + 8. FARMER + BUYER ============ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              Three sides. One platform.
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
              Built for farmers, buyers, and investors.
            </h2>
            <p className="mt-4 text-ink-muted text-lg max-w-xl">
              AGRIOS is the trust layer that connects the three sides of
              agricultural trade — with money moving safely in the middle.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Farmer card */}
            <div
              className="af-card p-8 lg:p-10 border-l-4 border-l-brand relative overflow-hidden"
              data-testid="role-card-farmer"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-brand/5 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand bg-brand/10 rounded-full px-3 py-1">
                  <Sprout className="w-3.5 h-3.5" /> For Farmers
                </div>
                <h3 className="font-heading font-extrabold text-3xl mt-5">
                  Sell more. Get paid faster. Earn smarter.
                </h3>
                <p className="mt-3 text-ink-muted">
                  Reach real buyers. Price with confidence. Settle in under 24
                  hours.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <RowBullet text="Direct access to verified, funded buyers." />
                  <RowBullet text="Data-driven pricing guidance — know your crop's worth." />
                  <RowBullet text="Sub-24h wallet payouts with full ledger transparency." />
                  <RowBullet text="Built-in video promotion to grow your demand." />
                </ul>
                <Link
                  to="/signup"
                  className="af-btn-primary mt-8"
                  data-testid="farmer-cta"
                >
                  Start selling <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Buyer card */}
            <div
              className="af-card p-8 lg:p-10 border-l-4 border-l-gold relative overflow-hidden"
              data-testid="role-card-buyer"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-dark bg-gold/10 rounded-full px-3 py-1">
                  <ShoppingCart className="w-3.5 h-3.5" /> For Buyers
                </div>
                <h3 className="font-heading font-extrabold text-3xl mt-5">
                  Source supply. Protect every rand, naira, cedi.
                </h3>
                <p className="mt-3 text-ink-muted">
                  Discover verified supply, lock price, and never lose money to
                  disputes again.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <RowBullet text="Only verified, KYC-checked suppliers." />
                  <RowBullet text="Transparent prices — see what the market really paid." />
                  <RowBullet text="Track every delivery from pickup to doorstep." />
                  <RowBullet text="Escrow protects every order until you confirm delivery." />
                </ul>
                <Link
                  to="/signup"
                  className="af-btn-accent mt-8"
                  data-testid="buyer-cta"
                >
                  Start sourcing <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Investor card (Phase F) */}
            <div
              className="af-card p-8 lg:p-10 border-l-4 border-l-emerald-600 relative overflow-hidden"
              data-testid="role-card-investor"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
                  <LineChart className="w-3.5 h-3.5" /> For Investors
                </div>
                <h3 className="font-heading font-extrabold text-3xl mt-5">
                  Back real farms. Transparent returns.
                </h3>
                <p className="mt-3 text-ink-muted">
                  Fund verified, admin-reviewed farm cycles. Watch every
                  milestone, every payout, every naira.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <RowBullet text="KYC-verified farmers with on-platform history." />
                  <RowBullet text="Clear risk bands (A/B/C) and use-of-funds for every cycle." />
                  <RowBullet text="Escrow-protected disbursements. Immutable ledger." />
                  <RowBullet text="Portfolio dashboard with expected and realized returns." />
                </ul>
                <Link
                  to="/signup"
                  className="af-btn-primary mt-8"
                  data-testid="investor-cta"
                >
                  Start investing <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 9. VIDEO / GROWTH ============ */}
      <section className="py-20 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 lg:order-2">
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
                Built-in distribution
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
                Sell with stories, not just listings.
              </h2>
              <p className="mt-4 text-ink-muted text-lg">
                Every supplier on AGRIOS gets an AI-powered video engine.
                Script, shoot, post — turn your produce into trust. Turn trust
                into sales.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-soft">
                <li className="flex gap-3">
                  <Video className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>20+ ready-to-shoot video scripts tailored to your crop.</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>Build trust with buyers before they even message.</span>
                </li>
                <li className="flex gap-3">
                  <TrendingUp className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <span>Video-promoted listings close faster and at better prices.</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 lg:order-1">
              <div className="relative aspect-[4/5] max-w-sm mx-auto rounded-[2rem] overflow-hidden shadow-lift bg-gradient-to-br from-zinc-900 to-brand-dark">
                <img
                  src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80"
                  alt="Farmer shooting a product video"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white bg-black/40 backdrop-blur rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-black/40 backdrop-blur rounded-full px-2.5 py-1">
                    <Eye className="w-3 h-3" /> 1.2K
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="font-heading font-extrabold text-xl">
                    Fresh tomatoes · Ogun State
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">
                    Harvested this morning · 500kg available
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 10. GLOBAL POSITIONING ============ */}
      <section id="global" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand bg-brand/10 rounded-full px-3 py-1.5">
              <Globe className="w-3.5 h-3.5" /> Global vision · Local execution
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl mt-5 text-ink">
              Built for global agricultural trade. Launching in Nigeria.
            </h2>
            <p className="mt-5 text-ink-muted text-lg leading-relaxed">
              Agricultural trade looks the same everywhere: fragmented supply,
              delayed payments, broken trust. The fix looks the same too —
              structured commerce, escrow, real money rails. We are starting in
              Nigeria because that's where the need is loudest. The system we
              are building works anywhere crops move and money follows.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <RolloutCard
              badge="Today"
              title="Nigeria"
              text="Live marketplace, escrow, wallet, Market Pulse."
              flag="🇳🇬"
              active
            />
            <RolloutCard
              badge="Next"
              title="Ghana · Kenya · Côte d'Ivoire"
              text="Multi-currency architecture already deployed. Local rails next."
              flag="🇬🇭 🇰🇪 🇨🇮"
            />
            <RolloutCard
              badge="Long-term"
              title="Global"
              text="The same infrastructure, wherever agricultural trade happens."
              flag="🌍"
            />
          </div>
        </div>
      </section>

      {/* ============ 11. SOCIAL PROOF ============ */}
      <section className="py-20 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              Proof on the ground
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
              Real farmers. Real buyers. Real money moving.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 af-stagger">
            <ProofCard
              metric="1,000+"
              label="Active users"
              sub="Farmers, buyers, and transporters across Nigeria."
            />
            <ProofCard
              metric="99.2%"
              label="Successful settlements"
              sub="Escrow disputes resolved within 48 hours."
            />
            <ProofCard
              metric="< 24h"
              label="Average payout"
              sub="From delivery confirmation to farmer wallet."
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {[
              {
                q: "AGRIOS paid me in 12 hours. Local markets never pay me in 12 hours.",
                n: "Adebayo O.",
                r: "Farmer · Ogun",
              },
              {
                q: "We source 40 tons of cassava monthly now with zero payment disputes. Escrow just works.",
                n: "Chioma O.",
                r: "Buyer · Lagos",
              },
              {
                q: "Clear pickups, clear routes, clear money. I've tripled my monthly income.",
                n: "Ibrahim T.",
                r: "Transporter · Lagos",
              },
            ].map((t) => (
              <div
                key={t.n}
                className="af-card p-6"
                data-testid={`testimonial-${t.n.replace(/\W/g, "")}`}
              >
                <div className="text-3xl text-brand leading-none">"</div>
                <p className="text-ink text-base leading-relaxed">{t.q}</p>
                <div className="mt-5 pt-5 border-t border-zinc-100">
                  <div className="font-heading font-bold text-ink">{t.n}</div>
                  <div className="text-xs text-ink-muted">{t.r}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 12. FINAL CTA ============ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="af-card p-10 lg:p-16 text-center bg-gradient-to-br from-brand to-brand-dark text-white relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-gold/15" />
            <div className="relative">
              <h2
                className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl"
                data-testid="final-cta-headline"
              >
                Move agricultural trade into the modern era.
              </h2>
              <p className="mt-5 text-white/80 max-w-2xl mx-auto text-lg">
                Marketplace, escrow, wallet, payouts, and intelligence — in one
                platform. Join the operators already trading on the AGRIOS
                rails.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/signup"
                  className="af-btn-accent"
                  data-testid="cta-signup"
                >
                  Create free account <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border border-white/30 text-white hover:bg-white/10 transition"
                  data-testid="cta-explore"
                >
                  Explore the marketplace
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 13. FOOTER ============ */}
      <footer className="py-10 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand grid place-items-center text-white font-heading font-extrabold text-sm">
              A
            </div>
            <span className="font-heading font-bold text-ink">AGRIOS</span>
            <span className="ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="text-center sm:text-right" data-testid="footer-line">
            Built for global agricultural trade. Launching in Nigeria.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============ Local presentation helpers ============ */

function TrustPill({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="font-heading font-bold text-ink text-sm">{title}</div>
        <div className="text-xs text-ink-muted mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function WhatCard({ icon: Icon, title, text }) {
  return (
    <div
      className="af-card af-card-hover p-6"
      data-testid={`what-${title.toLowerCase()}`}
    >
      <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-5">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-heading font-bold text-xl text-ink">{title}</h3>
      <p className="mt-2 text-ink-muted text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="font-heading font-extrabold text-base mt-0.5 text-ink">
        {value}
      </div>
    </div>
  );
}

function FinPill({ icon: Icon, title, sub }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gold/20 text-gold grid place-items-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-heading font-bold text-white text-sm">{title}</div>
        <div className="text-xs text-white/70 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function WBox({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
        {label}
      </div>
      <div className="font-heading font-extrabold mt-1">{value}</div>
    </div>
  );
}

function LedgerRow({ label, amount, positive }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
      <span className="text-white/80 truncate">{label}</span>
      <span
        className={`font-heading font-bold ${
          positive ? "text-gold" : "text-white"
        }`}
      >
        {amount}
      </span>
    </div>
  );
}

function RowBullet({ text }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
      <span className="text-ink-soft">{text}</span>
    </li>
  );
}

function RolloutCard({ badge, title, text, flag, active }) {
  return (
    <div
      className={`af-card p-6 ${
        active ? "border-2 border-brand shadow-lift" : ""
      }`}
      data-testid={`rollout-${title.toLowerCase().split(/\s/)[0]}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${
            active
              ? "bg-brand text-white"
              : "bg-zinc-100 text-ink-muted"
          }`}
        >
          {badge}
        </span>
        <div className="text-2xl">{flag}</div>
      </div>
      <div className="font-heading font-extrabold text-xl mt-4 text-ink">
        {title}
      </div>
      <div className="text-ink-muted text-sm mt-2">{text}</div>
    </div>
  );
}

function ProofCard({ metric, label, sub }) {
  return (
    <div className="af-card p-6">
      <div className="font-heading font-extrabold text-4xl text-brand">
        {metric}
      </div>
      <div className="font-heading font-bold text-ink mt-1">{label}</div>
      <div className="text-sm text-ink-muted mt-2">{sub}</div>
    </div>
  );
}
