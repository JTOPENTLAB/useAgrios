import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Clock,
  TrendingUp,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PieChart,
  CloudRain,
  BarChart3,
  Activity,
  FileText,
  Camera,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import RiskAcknowledgementModal, {
  hasAcknowledged,
  setAcknowledged,
} from "@/components/RiskAcknowledgementModal";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

const RISK_LABEL = {
  A: "Lower risk — short cycle, proven farmer, strong history",
  B: "Moderate risk — balanced return and protection",
  C: "Higher risk — higher potential return, newer cycle",
};

export default function OpportunityDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [opp, setOpp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);

  useEffect(() => {
    api
      .get(`/opportunities/${id}`)
      .then((r) => setOpp(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-10 text-center text-ink-muted flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!opp) return <div className="p-10 text-center">Opportunity not found.</div>;

  const currency = opp.currency || "NGN";
  const pct =
    opp.funding_target > 0
      ? Math.min(100, Math.round((opp.funding_raised / opp.funding_target) * 100))
      : 0;
  const remaining = Math.max(0, opp.funding_target - opp.funding_raised);

  const invest = async () => {
    const n = Number(amount);
    if (!n || n < opp.min_ticket) {
      toast.error(`Minimum investment is ${fmtMoney(opp.min_ticket, currency)}`);
      return;
    }
    if (n > remaining) {
      toast.error(`Only ${fmtMoney(remaining, currency)} remaining`);
      return;
    }
    if (!hasAcknowledged()) {
      setAckOpen(true);
      return;
    }
    await doInvest(n);
  };

  const doInvest = async (n) => {
    setSubmitting(true);
    try {
      const r = await api.post(`/opportunities/${id}/invest`, { amount: n });
      toast.success(
        `Invested ${fmtMoney(n, currency)}. Expected payout: ${fmtMoney(
          r.data.expected_payout,
          currency,
        )}`,
      );
      nav("/app/portfolio");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Investment failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isInvestor = user?.role === "investor";

  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="opp-detail-page">
      <RiskAcknowledgementModal
        open={ackOpen}
        onClose={() => setAckOpen(false)}
        onConfirm={() => {
          setAckOpen(false);
          setAcknowledged();
          const n = Number(amount);
          if (n) doInvest(n);
        }}
      />
      <div className="lg:col-span-2 space-y-6">
        <Link
          to="/app/opportunities"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
          data-testid="back-to-opps"
        >
          <ArrowLeft className="w-4 h-4" /> Back to opportunities
        </Link>

        <div className="af-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-brand">
                {opp.crop} · {opp.region}
              </div>
              <h1 className="font-heading font-extrabold text-3xl text-ink mt-2">
                {opp.title}
              </h1>
              <div className="flex items-center gap-3 mt-3 text-sm text-ink-muted flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {opp.region}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {opp.duration_months} months
                </span>
                {opp.farmer_verified && (
                  <span className="af-badge-verified">
                    <ShieldCheck className="w-3 h-3" /> Verified farmer
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-xs font-bold uppercase rounded-full px-3 py-1 border ${
                RISK_CLS[opp.risk_band] || RISK_CLS.B
              }`}
            >
              Risk {opp.risk_band}
            </span>
          </div>

          <p className="mt-5 text-ink-soft leading-relaxed">{opp.summary}</p>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-100">
            <Metric
              label="Target return"
              value={`${opp.target_return_pct}%`}
              tone="brand"
            />
            <Metric
              label="Duration"
              value={`${opp.duration_months}mo`}
            />
            <Metric
              label="Min ticket"
              value={fmtMoney(opp.min_ticket, currency)}
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ink-muted">Raised so far</span>
              <span className="font-heading font-bold text-ink">
                {fmtMoney(opp.funding_raised, currency)} ·{" "}
                <span className="text-brand">{pct}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-ink-muted mt-1.5">
              <span>{opp.investor_count || 0} investors</span>
              <span>
                Target: {fmtMoney(opp.funding_target, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Risk disclosure */}
        <div
          className="af-card p-5 border-l-4 border-l-gold bg-gold/5"
          data-testid="risk-disclosure"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gold-ink flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-heading font-bold text-ink">
                What Risk {opp.risk_band} means
              </div>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed">
                {RISK_LABEL[opp.risk_band] || RISK_LABEL.B}. All agricultural
                investments carry weather, yield, and market-price risk. AGRIOS
                escrow protects your capital during disbursement; it does not
                guarantee returns.
              </p>
            </div>
          </div>
        </div>

        {opp.use_of_funds_breakdown && opp.use_of_funds_breakdown.length > 0 && (
          <UseOfFundsPanel breakdown={opp.use_of_funds_breakdown} />
        )}

        {opp.risk_factors && opp.risk_factors.length > 0 && (
          <RiskFactorsPanel factors={opp.risk_factors} band={opp.risk_band} />
        )}

        {opp.use_of_funds && !opp.use_of_funds_breakdown && (
          <div className="af-card p-5">
            <h3 className="font-heading font-bold text-ink mb-2">
              Use of funds
            </h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              {opp.use_of_funds}
            </p>
          </div>
        )}

        <FarmUpdatesTimeline updates={opp.farm_updates || []} />

        <div className="af-card p-5">
          <h3 className="font-heading font-bold text-ink mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" /> Farmer
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand/10 text-brand grid place-items-center font-heading font-extrabold">
              {opp.farmer_name?.[0] || "F"}
            </div>
            <div>
              <div className="font-heading font-bold text-ink">
                {opp.farmer_name}
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                {opp.farmer_verified ? "KYC-verified · AGRIOS operator" : "Pending verification"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invest panel */}
      <aside className="lg:col-span-1">
        <div className="af-card p-6 lg:sticky lg:top-24" data-testid="invest-panel">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Invest now
          </div>
          <div className="font-heading font-extrabold text-2xl text-ink mt-1">
            {fmtMoney(remaining, currency)}{" "}
            <span className="text-ink-muted text-sm font-medium">
              remaining
            </span>
          </div>

          {opp.status !== "open" ? (
            <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm text-ink-muted text-center">
              <CheckCircle2 className="w-4 h-4 text-brand inline mr-1" />
              {opp.status === "funded"
                ? "This opportunity is fully funded."
                : `Status: ${opp.status}`}
            </div>
          ) : !isInvestor ? (
            <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm text-ink-muted">
              Sign in as an investor to back this opportunity.
              <Link
                to="/signup"
                className="block mt-2 af-btn-primary"
                data-testid="signup-investor-cta"
              >
                Create investor account
              </Link>
            </div>
          ) : (
            <>
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted mt-4 block">
                Amount ({currency})
              </label>
              <input
                className="af-input mt-1"
                type="number"
                min={opp.min_ticket}
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${opp.min_ticket.toLocaleString()}`}
                data-testid="invest-amount-input"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {[opp.min_ticket, opp.min_ticket * 2, opp.min_ticket * 5].map(
                  (n) => {
                    if (n > remaining) return null;
                    return (
                      <button
                        key={n}
                        onClick={() => setAmount(String(n))}
                        className="text-[11px] font-semibold rounded-full bg-zinc-100 hover:bg-zinc-200 text-ink-soft px-2.5 py-1"
                        data-testid={`quick-amt-${n}`}
                      >
                        {fmtMoney(n, currency)}
                      </button>
                    );
                  },
                )}
              </div>

              {amount && Number(amount) >= opp.min_ticket && (
                <div className="mt-4 p-3 rounded-xl bg-brand/5 border border-brand/15">
                  <div className="text-xs text-ink-muted">
                    Expected payout at maturity
                  </div>
                  <div className="font-heading font-extrabold text-xl text-brand mt-1">
                    {fmtMoney(
                      Number(amount) * (1 + opp.target_return_pct / 100),
                      currency,
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{fmtMoney(
                      Number(amount) * (opp.target_return_pct / 100),
                      currency,
                    )}{" "}
                    in {opp.duration_months}mo
                  </div>
                </div>
              )}

              <button
                onClick={invest}
                disabled={submitting || !amount}
                className="af-btn-primary w-full mt-4 disabled:opacity-60"
                data-testid="invest-submit-btn"
              >
                {submitting ? "Processing…" : "Invest from wallet"}
              </button>
              <div className="text-[11px] text-ink-muted mt-2 text-center">
                Debits your AGRIOS wallet · Immutable ledger entry
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div
        className={`font-heading font-extrabold text-xl mt-1 ${
          tone === "brand" ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}


/* ============ Use of funds panel ============ */

function UseOfFundsPanel({ breakdown }) {
  const total = breakdown.reduce((a, b) => a + (b.pct || 0), 0);
  // Build cumulative conic-gradient for a donut
  let acc = 0;
  const stops = breakdown
    .map((b) => {
      const start = (acc / total) * 100;
      acc += b.pct;
      const end = (acc / total) * 100;
      return `${b.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="af-card p-5" data-testid="use-of-funds-panel">
      <h3 className="font-heading font-bold text-ink mb-4 flex items-center gap-2">
        <PieChart className="w-4 h-4 text-brand" /> Use of funds
      </h3>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-36 h-36 flex-shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
          />
          <div className="absolute inset-5 bg-white rounded-full grid place-items-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
              Total
            </div>
            <div className="font-heading font-extrabold text-lg text-ink">
              100%
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          {breakdown.map((b) => (
            <div
              key={b.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-ink-soft truncate">{b.label}</span>
              </div>
              <span className="font-heading font-bold text-ink">{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Risk factors panel ============ */

const RISK_LEVEL_CLS = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-gold/10 text-gold-ink border-gold/30",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};
const RISK_ICON = {
  weather: CloudRain,
  market: BarChart3,
  execution: Activity,
  reporting: FileText,
};
const RISK_TYPE_LABEL = {
  weather: "Weather risk",
  market: "Market risk",
  execution: "Execution risk",
  reporting: "Reporting risk",
};

function RiskFactorsPanel({ factors, band }) {
  return (
    <div
      className="af-card p-5 border-l-4 border-l-gold bg-gold/5"
      data-testid="risk-factors-panel"
    >
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle className="w-5 h-5 text-gold-ink flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-heading font-bold text-ink">
            Risk breakdown
            <span className="ml-2 text-[10px] font-bold uppercase bg-white text-gold-ink border border-gold/30 rounded-full px-2 py-0.5">
              Band {band}
            </span>
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            Agricultural investments carry real risk. Here's an honest map for
            this specific cycle.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {factors.map((f) => {
          const Icon = RISK_ICON[f.type] || Activity;
          return (
            <div
              key={f.type}
              className="p-3 rounded-xl bg-white border border-zinc-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-ink-muted" />
                  <div className="font-heading font-bold text-sm text-ink">
                    {RISK_TYPE_LABEL[f.type] || f.type}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                    RISK_LEVEL_CLS[f.level] || RISK_LEVEL_CLS.medium
                  }`}
                >
                  {f.level}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                {f.note}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Farm updates timeline ============ */

function FarmUpdatesTimeline({ updates }) {
  if (!updates || updates.length === 0) {
    return (
      <div
        className="af-card p-5"
        data-testid="farm-updates-empty"
      >
        <h3 className="font-heading font-bold text-ink mb-2 flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand" /> Farm updates
        </h3>
        <p className="text-sm text-ink-muted">
          Updates will appear here as the cycle progresses. Farmers are
          required to post every 7 days.
        </p>
      </div>
    );
  }

  return (
    <div className="af-card p-5" data-testid="farm-updates-timeline">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-ink flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand" /> Farm updates
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/20 rounded-full px-2 py-0.5">
          {updates.length} update{updates.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-4">
        {updates.map((u, i) => (
          <div key={u.id || i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand grid place-items-center flex-shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              {i < updates.length - 1 && (
                <div className="w-px flex-1 bg-zinc-200 mt-2" />
              )}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-brand">
                  {u.stage}
                </span>
                {u.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                )}
                <span className="text-[11px] text-ink-muted">
                  {fmtFarmUpdateDate(u.created_at)}
                </span>
              </div>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed">
                {u.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtFarmUpdateDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diffDays = Math.round((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
