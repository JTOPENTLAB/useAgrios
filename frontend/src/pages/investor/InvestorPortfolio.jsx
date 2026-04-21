import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import api, { fmtMoney, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_CLS = {
  active: "bg-brand/10 text-brand border-brand/20",
  matured: "bg-gold/10 text-gold-ink border-gold/30",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function InvestorPortfolio() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/investments/summary").then((r) => setSummary(r.data)),
      api.get("/investments/mine").then((r) => setRows(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

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
