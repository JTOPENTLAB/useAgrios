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

        {opp.use_of_funds && (
          <div className="af-card p-5">
            <h3 className="font-heading font-bold text-ink mb-2">
              Use of funds
            </h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              {opp.use_of_funds}
            </p>
          </div>
        )}

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
