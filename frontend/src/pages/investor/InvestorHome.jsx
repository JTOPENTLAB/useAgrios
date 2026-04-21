import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Clock,
  Wallet as WalletIcon,
  LineChart,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import TrustStrip from "@/components/TrustStrip";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/investments/summary").then((r) => setSummary(r.data)).catch(() => {}),
      api.get("/opportunities?status=open").then((r) => setOpps(r.data)),
      api.get("/wallet").then((r) => setWallet(r.data?.wallet || r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const topOpps = useMemo(() => opps.slice(0, 3), [opps]);

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
        <div className="flex gap-2">
          <Link
            to="/app/opportunities"
            className="af-btn-primary"
            data-testid="browse-opps-btn"
          >
            <Sparkles className="w-4 h-4" /> Browse opportunities
          </Link>
        </div>
      </div>

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
            <HeroTile
              label="Active"
              value={summary?.active_count || 0}
              testId="portfolio-active"
            />
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

      {/* Wallet + quick action */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="af-card p-5 border-l-4 border-l-brand">
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
        <div className="af-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Risk mix
          </div>
          <div className="flex items-end gap-3 mt-3">
            {["A", "B", "C"].map((b) => {
              const v = summary?.by_risk_band?.[b] || 0;
              const total = summary?.total_invested || 1;
              return (
                <div key={b} className="flex-1 text-center">
                  <div className="h-20 bg-zinc-100 rounded-lg overflow-hidden flex flex-col justify-end">
                    <div
                      className={`${
                        b === "A"
                          ? "bg-emerald-500"
                          : b === "B"
                          ? "bg-gold"
                          : "bg-rose-500"
                      }`}
                      style={{ height: `${Math.min(100, (v / total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold mt-1 text-ink">Band {b}</div>
                </div>
              );
            })}
          </div>
        </div>
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
            No open opportunities yet. New cycles are added every week — enable
            notifications to be alerted.
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
          <span>
            {fmtMoney(opp.funding_raised, opp.currency)} raised
          </span>
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
