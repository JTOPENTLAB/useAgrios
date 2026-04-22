import { useEffect, useState } from "react";
import {
  Users,
  Wallet as WalletIcon,
  TrendingUp,
  Briefcase,
  Activity,
  Target,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

const RANGES = [7, 30, 90];

export default function AdminGrowth() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/stats/platform-metrics?days=${days}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-6" data-testid="admin-growth-page">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Growth analytics
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Platform metrics
          </h1>
          <p className="text-ink-muted mt-1">
            Top-of-funnel to first investment — the whole conversion journey.
          </p>
        </div>
        <div className="flex gap-1" data-testid="range-toggles">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                days === d
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink-soft border-zinc-200"
              }`}
              data-testid={`range-${d}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : (
        <>
          {/* Top-line tiles */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={Users}
              label="Signups"
              value={data?.period?.signups || 0}
              sub="in this window"
              testId="kpi-signups"
            />
            <Kpi
              icon={WalletIcon}
              label="Depositors"
              value={data?.period?.depositor_count || 0}
              testId="kpi-depositors"
            />
            <Kpi
              icon={Briefcase}
              label="Investors"
              value={data?.period?.investor_count || 0}
              tone="brand"
              testId="kpi-investors"
            />
            <Kpi
              icon={TrendingUp}
              label="Volume invested"
              value={fmtMoney(data?.period?.total_invested || 0, "NGN")}
              sub={`${data?.period?.invest_count || 0} allocations`}
              tone="gold"
              testId="kpi-volume"
            />
          </div>

          {/* Funnel */}
          <div className="af-card p-6" data-testid="funnel-card">
            <h3 className="font-heading font-bold text-ink mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-brand" /> Conversion funnel
            </h3>
            <div className="space-y-3">
              <FunnelRow
                label="Signup → Deposit"
                pct={data?.funnel?.signup_to_deposit_pct || 0}
                caption={`${data?.period?.depositor_count || 0} / ${
                  data?.period?.signups || 0
                } signups`}
                testId="funnel-signup-deposit"
              />
              <FunnelRow
                label="Deposit → First Invest"
                pct={data?.funnel?.deposit_to_invest_pct || 0}
                caption={`${data?.period?.investor_count || 0} / ${
                  data?.period?.depositor_count || 0
                } depositors`}
                testId="funnel-deposit-invest"
              />
              <FunnelRow
                label="Signup → Invest (end-to-end)"
                pct={data?.funnel?.signup_to_invest_pct || 0}
                caption={`${data?.period?.investor_count || 0} / ${
                  data?.period?.signups || 0
                } signups`}
                testId="funnel-signup-invest"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Signups by role */}
            <div className="af-card p-6" data-testid="signups-by-role">
              <h3 className="font-heading font-bold text-ink mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" /> Signups by role
              </h3>
              <div className="space-y-2">
                {Object.entries(data?.period?.signups_by_role || {})
                  .filter(([k]) => k !== "admin")
                  .map(([role, n]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                      data-testid={`signup-role-${role}`}
                    >
                      <span className="capitalize font-semibold text-ink">
                        {role}
                      </span>
                      <span className="font-heading font-extrabold text-lg text-ink">
                        {n}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* UTM */}
            <div className="af-card p-6" data-testid="utm-card">
              <h3 className="font-heading font-bold text-ink mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand" /> Traffic by source
              </h3>
              {(data?.utm_sources || []).length === 0 ? (
                <div className="py-6 text-center text-sm text-ink-muted">
                  No tracked traffic yet. Add{" "}
                  <code className="font-mono text-ink">?utm_source=tiktok</code>{" "}
                  etc. to your landing page URLs to start capturing.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.utm_sources.map((r) => (
                    <div
                      key={r.source}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                      data-testid={`utm-${r.source}`}
                    >
                      <span className="font-mono text-sm text-ink">
                        {r.source}
                      </span>
                      <span className="font-heading font-extrabold text-ink">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, testId }) {
  const toneCls =
    tone === "brand"
      ? "bg-gradient-to-br from-brand to-brand-dark text-white border-0"
      : tone === "gold"
      ? "bg-gradient-to-br from-gold/90 to-amber-500 text-white border-0"
      : "bg-white text-ink";
  return (
    <div className={`af-card p-5 ${toneCls}`} data-testid={testId}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="font-heading font-extrabold text-2xl mt-1.5">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelRow({ label, pct, caption, testId }) {
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-ink-soft text-sm">{label}</span>
        <span className="font-heading font-extrabold text-ink">{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand to-emerald-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="text-[11px] text-ink-muted mt-1">{caption}</div>
    </div>
  );
}
