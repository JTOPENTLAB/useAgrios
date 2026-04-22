import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { TrendingUp, Clock, ShieldCheck, ArrowRight, Info } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function OnboardingInvest() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { refreshState } = useOutletContext() || {};
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/opportunities")
      .then((r) => setRows((r.data || []).slice(0, 3)))
      .finally(() => setLoading(false));
  }, []);

  const finish = async () => {
    try {
      await api.post("/onboarding/complete");
      refreshState && refreshState();
    } catch {
      // non-blocking
    }
    nav("/onboarding/success");
  };

  const isInvestor = user?.role === "investor";
  const currency = user?.currency || "NGN";

  const copy = {
    title: isInvestor
      ? "Start your first allocation."
      : "Explore what's live on AGRIOS.",
    sub: isInvestor
      ? "Most investors start with ₦50,000. Pick a cycle that fits your goals."
      : "See a few live cycles to understand the platform. You can skip ahead.",
  };

  return (
    <div className="space-y-6" data-testid="onboarding-invest">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Step 4 · First move
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
          {copy.title}
        </h1>
        <p className="text-ink-muted mt-2">{copy.sub}</p>
      </div>

      {isInvestor && (
        <div
          className="af-card p-4 bg-brand/5 border-brand/20 flex items-start gap-3"
          data-testid="invest-avg-note"
        >
          <Info className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink-soft">
            <strong className="text-ink">Most investors start with ₦50,000.</strong>{" "}
            Every opportunity on AGRIOS is admin-reviewed, risk-banded, and
            milestone-escrowed.
          </div>
        </div>
      )}

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">
          Loading opportunities…
        </div>
      ) : rows.length === 0 ? (
        <div className="af-card p-10 text-center text-ink-muted">
          No open opportunities right now. Your dashboard will notify you when
          new cycles launch.
        </div>
      ) : (
        <div className="grid gap-3" data-testid="featured-opps">
          {rows.map((o) => {
            const pct =
              o.funding_target > 0
                ? Math.min(100, Math.round((o.funding_raised / o.funding_target) * 100))
                : 0;
            return (
              <Link
                key={o.id}
                to={`/app/opportunities/${o.id}`}
                className="af-card p-5 hover:border-brand/30 transition block"
                data-testid={`featured-opp-${o.id}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand">
                        {o.crop} · {o.region}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                          RISK_CLS[o.risk_band] || RISK_CLS.B
                        }`}
                      >
                        Risk {o.risk_band}
                      </span>
                      {o.farmer_verified && (
                        <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <div className="font-heading font-bold text-ink mt-1">
                      {o.title}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {o.target_return_pct}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {o.duration_months}mo
                      </span>
                      <span>Min {fmtMoney(o.min_ticket, o.currency)}</span>
                    </div>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <div className="font-heading font-bold text-ink text-sm">
                      {fmtMoney(o.funding_raised, o.currency)} /{" "}
                      {fmtMoney(o.funding_target, o.currency)}
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-2">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-muted mt-1 uppercase font-bold">
                      {pct}% funded
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          data-testid="invest-skip-btn"
        >
          Skip — I'll explore later
        </button>
        <Link
          to="/app/opportunities"
          onClick={() => {
            // Fire-and-forget: mark onboarding complete when they jump to marketplace
            api.post("/onboarding/complete").catch(() => {});
          }}
          className="af-btn-primary"
          data-testid="explore-opps-btn"
        >
          Explore opportunities <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {!isInvestor && (
        <div className="text-center text-xs text-ink-muted pt-2">
          <button
            type="button"
            onClick={finish}
            className="text-brand font-semibold hover:underline"
            data-testid="finish-onboarding-btn"
          >
            I'm done — take me to my dashboard
          </button>
        </div>
      )}
      {isInvestor && (
        <div className="text-center text-xs text-ink-muted pt-2">
          <button
            type="button"
            onClick={finish}
            className="text-brand font-semibold hover:underline"
            data-testid="finish-onboarding-btn"
          >
            I'll invest later — go to my dashboard
          </button>
        </div>
      )}
    </div>
  );
}
