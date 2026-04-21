import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  Wallet as WalletIcon,
  LineChart,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Flame,
  Users,
  Landmark,
  Circle,
  ArrowDownRight,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import TrustStrip from "@/components/TrustStrip";
import RecentlyMaturedCarousel from "@/components/RecentlyMaturedCarousel";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function InvestorHome() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [summary, setSummary] = useState(null);
  const [opps, setOpps] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/investments/summary").then((r) => setSummary(r.data)).catch(() => {}),
      api.get("/opportunities?status=open").then((r) => setOpps(r.data)),
      api.get("/wallet").then((r) => setWallet(r.data?.wallet || r.data)).catch(() => {}),
      api.get("/stats/investor-platform").then((r) => setPlatform(r.data)).catch(() => {}),
      api.get("/investor/activity").then((r) => setActivity(r.data?.events || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const topOpps = useMemo(() => opps.slice(0, 3), [opps]);
  const hasInvestments = (summary?.active_count || 0) + (summary?.matured_count || 0) + (summary?.paid_count || 0) > 0;

  return (
    <div className="space-y-7" data-testid="investor-dashboard">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Investor
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-ink-muted mt-1">
            Back verified farm cycles. Watch your capital work.
          </p>
        </div>
        <Link
          to="/app/opportunities"
          className="af-btn-primary"
          data-testid="browse-opps-btn"
        >
          <Sparkles className="w-4 h-4" /> Browse opportunities
        </Link>
      </div>

      {/* Platform stats band — always visible, builds trust */}
      <PlatformStatsBand platform={platform} />

      <RecentlyMaturedCarousel limit={6} />

      {/* Portfolio hero */}
      <section
        className="rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark text-white p-6 sm:p-8 shadow-lift relative overflow-hidden"
        data-testid="portfolio-hero"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70">
            <LineChart className="w-3.5 h-3.5" /> Portfolio value
          </div>
          <div
            className="font-heading font-extrabold text-5xl sm:text-6xl mt-2 tracking-tight leading-none"
            data-testid="portfolio-total"
          >
            {loading ? "—" : fmtMoney(summary?.total_invested || 0, currency)}
          </div>
          <div className="text-white/80 mt-2 text-sm">
            Across {(summary?.active_count || 0) + (summary?.matured_count || 0) + (summary?.paid_count || 0)} investment
            {((summary?.active_count || 0) + (summary?.matured_count || 0) + (summary?.paid_count || 0)) === 1 ? "" : "s"}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
            <HeroTile label="Active" value={summary?.active_count || 0} testId="portfolio-active" />
            <HeroTile
              label="Expected returns"
              value={fmtMoney(summary?.expected_returns || 0, currency)}
              testId="portfolio-expected"
              highlight
            />
            <HeroTile
              label="Realized"
              value={fmtMoney(summary?.realized_returns || 0, currency)}
              testId="portfolio-realized"
            />
          </div>
        </div>
      </section>

      <TrustStrip />

      {/* Wallet + Risk Mix + Protection */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="af-card p-5 border-l-4 border-l-brand" data-testid="wallet-tile">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1">
            <WalletIcon className="w-3.5 h-3.5" /> Investable balance
          </div>
          <div className="font-heading font-extrabold text-2xl mt-2">
            {fmtMoney(wallet?.available || 0, currency)}
          </div>
          <Link
            to="/app/wallet"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand mt-2 hover:underline"
          >
            Fund wallet <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <RiskMixCard summary={summary} />

        <div className="af-card p-5 border-l-4 border-l-gold bg-gradient-to-br from-gold/5 to-white">
          <div className="text-xs font-bold uppercase tracking-wider text-gold-dark flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> How we protect you
          </div>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Every farmer is KYC-verified. Every opportunity is admin-reviewed.
            Funds move via escrow with a full audit trail.
          </p>
        </div>
      </div>

      {/* Start Here (empty-state) or Recent Activity (populated) */}
      {!hasInvestments ? (
        <StartHereSteps />
      ) : (
        <ActivityFeed events={activity} />
      )}

      {/* Featured opportunities */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">
              Featured now
            </div>
            <h2 className="font-heading font-bold text-2xl text-ink">
              Open funding opportunities
            </h2>
          </div>
          <Link
            to="/app/opportunities"
            className="text-sm font-semibold text-brand hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {topOpps.length === 0 ? (
          <div className="af-card p-10 text-center text-ink-muted">
            New cycles are added every week — check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topOpps.map((o) => (
              <OpportunityCard key={o.id} opp={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============ Platform Stats Band ============ */

function PlatformStatsBand({ platform }) {
  if (!platform) return null;
  const nf = (n) => {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(0)}M+`;
    if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k+`;
    return `₦${n.toLocaleString()}`;
  };
  const cnf = (n) => {
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k+`;
    return `${n}+`;
  };
  return (
    <div
      className="af-card p-4 sm:p-5 flex flex-wrap items-center gap-5 bg-gradient-to-br from-white via-zinc-50 to-white border-l-4 border-l-emerald-500"
      data-testid="platform-stats-band"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Live on AGRIOS
      </div>
      <PlatformTile
        icon={Landmark}
        value={nf(platform.funded_total)}
        label="funded"
        testId="platform-funded"
      />
      <PlatformTile
        icon={Users}
        value={cnf(platform.active_investors)}
        label="investors"
        testId="platform-investors"
      />
      <PlatformTile
        icon={Flame}
        value={`${platform.active_cycles}`}
        label="active farm cycles"
        testId="platform-cycles"
      />
    </div>
  );
}

function PlatformTile({ icon: Icon, value, label, testId }) {
  return (
    <div
      className="flex items-center gap-2.5 pl-4 border-l border-zinc-200/70 first:pl-0 first:border-l-0"
      data-testid={testId}
    >
      <Icon className="w-4 h-4 text-brand" />
      <div>
        <div className="font-heading font-extrabold text-ink text-lg leading-none">
          {value}
        </div>
        <div className="text-[11px] uppercase font-semibold tracking-wider text-ink-muted mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}

/* ============ Risk Mix ============ */

function RiskMixCard({ summary }) {
  // Always shows percentages. Falls back to the spec (40/35/25) so the card
  // never looks empty, but real percentages compute from by_risk_band when
  // there is any active investment.
  const byBand = summary?.by_risk_band || {};
  const total = (byBand.A || 0) + (byBand.B || 0) + (byBand.C || 0);
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : null);
  const defaults = { A: 40, B: 35, C: 25 };
  const A = total > 0 ? pct(byBand.A) : defaults.A;
  const B = total > 0 ? pct(byBand.B) : defaults.B;
  const C = total > 0 ? pct(byBand.C) : defaults.C;
  const isSample = total === 0;

  return (
    <div className="af-card p-5" data-testid="risk-mix-card">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Risk mix
        </div>
        {isSample && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-zinc-100 rounded-full px-2 py-0.5">
            Recommended
          </span>
        )}
      </div>
      <div className="flex items-end gap-3 mt-3">
        {[
          { band: "A", pct: A, color: "bg-emerald-500" },
          { band: "B", pct: B, color: "bg-gold" },
          { band: "C", pct: C, color: "bg-rose-500" },
        ].map(({ band, pct, color }) => (
          <div key={band} className="flex-1 text-center">
            <div className="h-20 bg-zinc-100 rounded-lg overflow-hidden flex flex-col justify-end">
              <div
                className={color}
                style={{ height: `${Math.max(pct, 6)}%` }}
              />
            </div>
            <div className="text-xs font-bold mt-1 text-ink">
              Band {band}
            </div>
            <div className="text-[11px] text-ink-muted">{pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Start Here empty-state ============ */

function StartHereSteps() {
  const steps = [
    {
      icon: WalletIcon,
      title: "Fund your wallet",
      text: "Top up with Paystack or bank transfer. Only invested capital leaves your wallet.",
      href: "/app/wallet",
      cta: "Fund wallet",
    },
    {
      icon: Sparkles,
      title: "Explore opportunities",
      text: "Browse verified, admin-reviewed farm cycles. Filter by crop, region, or risk band.",
      href: "/app/opportunities",
      cta: "Browse cycles",
    },
    {
      icon: CheckCircle2,
      title: "Make your first investment",
      text: "Pick a cycle that matches your risk appetite. Escrow locks funds until disbursement.",
      href: "/app/opportunities",
      cta: "Start investing",
    },
  ];
  return (
    <section className="af-card p-6 sm:p-8" data-testid="start-here-section">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
        <Sparkles className="w-3.5 h-3.5" /> Start here
      </div>
      <h2 className="font-heading font-extrabold text-2xl text-ink mt-1">
        Your first three steps
      </h2>
      <p className="text-ink-muted mt-1">
        Three minutes from here to your first farm cycle.
      </p>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.title}
              to={s.href}
              className="af-card af-card-hover p-5 group border-2 hover:border-brand/30"
              data-testid={`start-step-${i + 1}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand text-white grid place-items-center font-heading font-extrabold">
                  {i + 1}
                </div>
                <Icon className="w-5 h-5 text-brand" />
              </div>
              <div className="font-heading font-bold text-ink mt-4">
                {s.title}
              </div>
              <p className="text-sm text-ink-muted mt-1">{s.text}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand group-hover:underline">
                {s.cta} <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ============ Activity Feed ============ */

function ActivityFeed({ events }) {
  const icons = {
    invested: { Icon: TrendingUp, cls: "bg-brand/10 text-brand" },
    payout: { Icon: ArrowDownRight, cls: "bg-emerald-100 text-emerald-700" },
    milestone: { Icon: Flame, cls: "bg-gold/15 text-gold-ink" },
  };
  return (
    <section className="af-card p-6" data-testid="activity-feed">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Recent activity
          </div>
          <h2 className="font-heading font-bold text-xl text-ink mt-0.5">
            What's moving in your portfolio
          </h2>
        </div>
        <Link
          to="/app/portfolio"
          className="text-sm font-semibold text-brand hover:underline flex items-center gap-1"
        >
          Full portfolio <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted py-6 text-center">
          Activity will appear here as your portfolio moves.
        </p>
      ) : (
        <div className="space-y-2" data-testid="activity-list">
          {events.map((e, i) => {
            const spec = icons[e.kind] || icons.invested;
            const Icon = spec.Icon;
            return (
              <div
                key={`${e.ref}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition border border-zinc-100"
                data-testid={`activity-row-${i}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 ${spec.cls}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm truncate">
                    {e.title}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    {fmtActivityDate(e.ts)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function fmtActivityDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/* ============ Shared helpers ============ */

function HeroTile({ label, value, testId, highlight }) {
  return (
    <div data-testid={testId}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </div>
      <div
        className={`font-heading font-extrabold text-xl mt-1 ${
          highlight ? "text-gold" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function OpportunityCard({ opp }) {
  const pct =
    opp.funding_target > 0
      ? Math.min(100, Math.round((opp.funding_raised / opp.funding_target) * 100))
      : 0;
  return (
    <Link
      to={`/app/opportunities/${opp.id}`}
      className="af-card af-card-hover p-5 flex flex-col gap-3"
      data-testid={`opp-card-${opp.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            {opp.crop} · {opp.region}
          </div>
          <div className="font-heading font-bold text-ink text-lg mt-1 line-clamp-2">
            {opp.title}
          </div>
        </div>
        <span
          className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border flex-shrink-0 ${
            RISK_CLS[opp.risk_band] || RISK_CLS.B
          }`}
        >
          Risk {opp.risk_band}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading font-extrabold text-xl text-ink">
          {opp.target_return_pct}%
        </span>
        <span className="text-xs text-ink-muted">
          target return · {opp.duration_months}mo
        </span>
      </div>
      <div>
        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-ink-muted">
          <span>{fmtMoney(opp.funding_raised, opp.currency)} raised</span>
          <span className="font-semibold text-ink">{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-muted pt-2 border-t border-zinc-100">
        <Clock className="w-3.5 h-3.5" />
        Min {fmtMoney(opp.min_ticket, opp.currency)} · {opp.investor_count || 0} investor
        {opp.investor_count === 1 ? "" : "s"}
      </div>
    </Link>
  );
}
