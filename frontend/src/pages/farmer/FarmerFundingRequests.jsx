import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Plus, ArrowRight } from "lucide-react";
import api, { fmtMoney, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_CLS = {
  review: "bg-gold/10 text-gold-ink border-gold/30",
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  funded: "bg-brand/10 text-brand border-brand/25",
  active: "bg-brand/10 text-brand border-brand/25",
  rejected: "bg-red-50 text-red-700 border-red-200",
  closed: "bg-zinc-100 text-ink-muted border-zinc-200",
};

export default function FarmerFundingRequests() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/opportunities/mine")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6" data-testid="farmer-funding-requests">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Farmer · Funding
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Your funding requests
          </h1>
          <p className="text-ink-muted mt-1">
            Track every submission — from review to fully funded.
          </p>
        </div>
        <Link
          to="/app/farmer/fund"
          className="af-btn-primary"
          data-testid="new-opp-btn"
        >
          <Plus className="w-4 h-4" /> New funding request
        </Link>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="af-card p-10 text-center" data-testid="no-opps-empty">
          <Sparkles className="w-10 h-10 text-brand mx-auto mb-2" />
          <div className="font-heading font-bold text-ink">
            Raise your first cycle
          </div>
          <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
            Submit a funding opportunity. Verified investors on AGRIOS will
            back your farm cycle. Payouts settle to your wallet at maturity.
          </p>
          <Link
            to="/app/farmer/fund"
            className="af-btn-primary mt-4 inline-flex"
            data-testid="empty-new-opp-btn"
          >
            Submit funding request <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-testid="my-opps-list">
          {rows.map((o) => {
            const pct =
              o.funding_target > 0
                ? Math.min(
                    100,
                    Math.round((o.funding_raised / o.funding_target) * 100),
                  )
                : 0;
            return (
              <Link
                key={o.id}
                to={`/app/opportunities/${o.id}`}
                className="block af-card p-5 hover:border-brand/30 transition"
                data-testid={`my-opp-${o.id}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand">
                        {o.crop} · {o.region}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                          STATUS_CLS[o.status] || STATUS_CLS.review
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                    <div className="font-heading font-bold text-ink mt-1">
                      {o.title}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      Submitted {fmtDate(o.created_at)} · {o.investor_count || 0}{" "}
                      investor{o.investor_count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-bold text-ink">
                      {fmtMoney(o.funding_raised, currency)}{" "}
                      <span className="text-ink-muted text-sm">
                        / {fmtMoney(o.funding_target, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-2 w-36 ml-auto">
                      <div
                        className="h-full bg-brand transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {pct}% raised
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
