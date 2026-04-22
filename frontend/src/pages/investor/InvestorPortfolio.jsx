import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Clock, ArrowRight, PieChart as PieIcon, CalendarDays, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_CLS = {
  active: "bg-brand/10 text-brand border-brand/20",
  matured: "bg-gold/10 text-gold-ink border-gold/30",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const BAND_COLORS = {
  A: "#10b981", // emerald
  B: "#F59E0B", // gold
  C: "#ef4444", // rose
};

export default function InvestorPortfolio() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/investments/summary").then((r) => setSummary(r.data)),
      api.get("/investments/mine").then((r) => setRows(r.data)),
      api.get("/investor/kyc-status").then((r) => setKyc(r.data)).catch(() => setKyc(null)),
    ]).finally(() => setLoading(false));
  }, []);

  const upcomingPayouts = useMemo(() => {
    const now = Date.now();
    return rows
      .filter((r) => r.status !== "paid" && r.maturity_at)
      .map((r) => ({
        ...r,
        ts: new Date(r.maturity_at).getTime(),
      }))
      .filter((r) => !isNaN(r.ts) && r.ts >= now - 86400000 * 2)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="space-y-6" data-testid="investor-portfolio">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Portfolio
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">
          Your investments
        </h1>
        <p className="text-ink-muted mt-1">
          Track every cycle, every payout, every return.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Kpi
          label="Total invested"
          value={fmtMoney(summary?.total_invested || 0, currency)}
          tone="brand"
          testId="kpi-invested"
        />
        <Kpi
          label="Expected returns"
          value={fmtMoney(summary?.expected_returns || 0, currency)}
          tone="gold"
          testId="kpi-expected"
        />
        <Kpi
          label="Realized returns"
          value={fmtMoney(summary?.realized_returns || 0, currency)}
          testId="kpi-realized"
        />
        <Kpi
          label="Active cycles"
          value={summary?.active_count || 0}
          testId="kpi-active"
        />
      </div>

      {/* Risk allocation + Upcoming payouts */}
      <div className="grid lg:grid-cols-5 gap-4">
        <RiskDonut
          byBand={summary?.by_risk_band}
          total={summary?.total_invested || 0}
          currency={currency}
        />
        <UpcomingPayouts items={upcomingPayouts} currency={currency} />
      </div>

      <KycTierCard kyc={kyc} onUpgraded={() => api.get("/investor/kyc-status").then((r) => setKyc(r.data))} />

      {/* Investments list */}
      <div className="af-card p-6">
        <h3 className="font-heading font-bold text-ink mb-4">All investments</h3>
        {loading ? (
          <div className="py-10 text-center text-ink-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center" data-testid="portfolio-empty">
            <TrendingUp className="w-10 h-10 text-ink-muted mx-auto mb-2" />
            <div className="font-heading font-bold text-ink">
              No investments yet
            </div>
            <p className="text-sm text-ink-muted mt-1">
              Browse the marketplace and back your first farm cycle.
            </p>
            <Link
              to="/app/opportunities"
              className="af-btn-primary mt-4 inline-flex"
              data-testid="empty-cta"
            >
              Browse opportunities <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3" data-testid="investments-list">
            {rows.map((r) => (
              <Link
                key={r.id}
                to={`/app/opportunities/${r.opportunity_id}`}
                className="block p-4 rounded-xl border border-zinc-100 hover:border-brand/30 transition bg-zinc-50/30"
                data-testid={`inv-row-${r.id}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-heading font-bold text-ink truncate">
                        {r.opportunity?.title || r.opportunity_id}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                          STATUS_CLS[r.status] || STATUS_CLS.active
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {r.opportunity?.crop || "—"} · {r.opportunity?.region || "—"} ·{" "}
                      {r.opportunity?.farmer_name || "Farmer"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-bold text-ink">
                      {fmtMoney(r.amount, r.currency)}
                    </div>
                    <div className="text-xs text-brand mt-0.5 font-semibold">
                      → {fmtMoney(r.expected_payout, r.currency)} at maturity
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {r.expected_return_pct}% return
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Matures {fmtDate(r.maturity_at)}
                  </span>
                  {r.status === "paid" && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const { data } = await api.post(
                            `/investments/${r.id}/reinvest`,
                            { amount: r.amount },
                          );
                          window.location.href = `/app/opportunities/${data.suggested_opportunity_id}?prefill=${data.suggested_amount}`;
                        } catch {
                          // Fallback — send to marketplace
                          window.location.href = "/app/opportunities";
                        }
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-brand font-semibold hover:text-brand-dark"
                      data-testid={`reinvest-${r.id}`}
                    >
                      Reinvest now
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, testId }) {
  const toneCls =
    tone === "brand"
      ? "bg-gradient-to-br from-brand to-brand-dark text-white border-0"
      : tone === "gold"
      ? "bg-gradient-to-br from-gold/90 to-amber-500 text-white border-0"
      : "bg-white text-ink";
  return (
    <div className={`af-card p-5 ${toneCls}`} data-testid={testId}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="font-heading font-extrabold text-2xl mt-2">{value}</div>
    </div>
  );
}

function RiskDonut({ byBand, total, currency }) {
  const bands = ["A", "B", "C"];
  const data = bands.map((b) => ({ band: b, value: Number((byBand || {})[b] || 0) }));
  const sum = data.reduce((a, d) => a + d.value, 0);
  const size = 160;
  const r = 64;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 22;
  let offset = 0;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className="af-card p-6 lg:col-span-2"
      data-testid="risk-donut-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <PieIcon className="w-4 h-4 text-brand" />
        <h3 className="font-heading font-bold text-ink">Risk allocation</h3>
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={cx}
              cy={cy}
              r={r}
              stroke="#f4f4f5"
              strokeWidth={strokeW}
              fill="none"
            />
            {sum > 0 &&
              data.map((d) => {
                const len = (d.value / sum) * circumference;
                const circle = (
                  <circle
                    key={d.band}
                    cx={cx}
                    cy={cy}
                    r={r}
                    stroke={BAND_COLORS[d.band]}
                    strokeWidth={strokeW}
                    fill="none"
                    strokeDasharray={`${len} ${circumference - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return circle;
              })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Invested
              </div>
              <div className="font-heading font-extrabold text-lg text-ink">
                {fmtMoney(total || 0, currency)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] space-y-2">
          {data.map((d) => {
            const pct = sum > 0 ? Math.round((d.value / sum) * 100) : 0;
            return (
              <div
                key={d.band}
                className="flex items-center justify-between text-sm"
                data-testid={`risk-donut-band-${d.band}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: BAND_COLORS[d.band] }}
                  />
                  <span className="text-ink-soft">
                    Risk <strong className="text-ink">{d.band}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span>{fmtMoney(d.value, currency)}</span>
                  <span className="font-bold text-ink">{pct}%</span>
                </div>
              </div>
            );
          })}
          {sum === 0 && (
            <div className="text-xs text-ink-muted pt-2">
              No allocations yet. Your breakdown appears as soon as you invest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UpcomingPayouts({ items, currency }) {
  return (
    <div className="af-card p-6 lg:col-span-3" data-testid="upcoming-payouts-card">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-brand" />
        <h3 className="font-heading font-bold text-ink">Upcoming payouts</h3>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-ink-muted">
          No payouts scheduled. Active cycles will appear here as maturity approaches.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const days = Math.max(0, Math.ceil((r.ts - Date.now()) / 86400000));
            return (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                data-testid={`payout-row-${r.id}`}
              >
                <div>
                  <div className="font-heading font-bold text-sm text-ink truncate max-w-[320px]">
                    {r.opportunity?.title || r.opportunity_id}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {r.opportunity?.crop || "—"} · matures in {days}d ·{" "}
                    {fmtDate(r.maturity_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading font-bold text-ink">
                    {fmtMoney(r.expected_payout, currency)}
                  </div>
                  <div className="text-[10px] text-brand font-bold uppercase">
                    {r.expected_return_pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TIER_ORDER = ["unverified", "bronze", "silver", "gold"];
const TIER_COLORS = {
  unverified: "bg-zinc-100 text-ink-muted border-zinc-200",
  bronze: "bg-amber-50 text-amber-800 border-amber-200",
  silver: "bg-slate-100 text-slate-700 border-slate-300",
  gold: "bg-gold/15 text-gold-ink border-gold/40",
};

function KycTierCard({ kyc, onUpgraded }) {
  const [upgrading, setUpgrading] = useState(false);
  if (!kyc) return null;

  const currentIdx = TIER_ORDER.indexOf(kyc.tier);
  const nextTier = TIER_ORDER[currentIdx + 1];
  const limit = kyc.max_investment || 0;
  const used = kyc.used || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const upgrade = async () => {
    if (!nextTier) return;
    const name = window.prompt(
      `Upgrade to ${nextTier.toUpperCase()}. Enter your full legal name:`,
    );
    if (!name) return;
    const id = window.prompt("Enter your government-issued ID number:");
    if (!id) return;
    setUpgrading(true);
    try {
      await api.post("/investor/kyc-upgrade", {
        requested_tier: nextTier,
        full_legal_name: name,
        id_number: id,
      });
      toast.success(`Upgraded to ${nextTier.toUpperCase()} tier ✅`);
      onUpgraded && onUpgraded();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="af-card p-6" data-testid="kyc-tier-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink">
              Investor tier:{" "}
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold uppercase rounded-full px-2.5 py-0.5 border align-middle ${
                  TIER_COLORS[kyc.tier] || TIER_COLORS.unverified
                }`}
                data-testid="kyc-tier-badge"
              >
                {kyc.label}
              </span>
            </h3>
            <p className="text-sm text-ink-muted mt-1">{kyc.rationale}</p>
          </div>
        </div>
        {nextTier && (
          <button
            onClick={upgrade}
            disabled={upgrading}
            className="af-btn-primary text-sm disabled:opacity-60"
            data-testid="kyc-upgrade-btn"
          >
            {upgrading ? "Processing…" : `Upgrade to ${nextTier.toUpperCase()}`}
          </button>
        )}
      </div>
      {limit > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-ink-muted">Investment capacity used</span>
            <span className="font-heading font-bold text-ink">
              {pct}% · {fmtMoney(used, "NGN")} / {fmtMoney(limit, "NGN")}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${pct}%` }}
              data-testid="kyc-usage-bar"
            />
          </div>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-zinc-100 grid sm:grid-cols-4 gap-3">
        {kyc.all_tiers.map((t) => (
          <div
            key={t.tier}
            className={`p-3 rounded-xl border text-xs ${
              t.tier === kyc.tier
                ? "bg-brand/5 border-brand/30"
                : "bg-zinc-50 border-zinc-100"
            }`}
            data-testid={`kyc-tier-row-${t.tier}`}
          >
            <div className="font-heading font-bold text-ink">{t.label}</div>
            <div className="text-ink-muted mt-0.5">
              up to {fmtMoney(t.max_investment, "NGN")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

