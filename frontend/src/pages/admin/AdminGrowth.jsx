import { useEffect, useState } from "react";
import {
  Users,
  Wallet as WalletIcon,
  TrendingUp,
  Briefcase,
  Activity,
  Target,
  LineChart,
  Mail,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

const RANGES = [7, 30, 90];

export default function AdminGrowth() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(true);
  const cohortWeeks = 8;

  useEffect(() => {
    setLoading(true);
    api
      .get(`/stats/platform-metrics?days=${days}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    setCohortLoading(true);
    api
      .get(`/admin/cohorts/retention?weeks=${cohortWeeks}`)
      .then((r) => setCohorts(r.data))
      .catch(() => setCohorts(null))
      .finally(() => setCohortLoading(false));
  }, []);

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
                caption={_captionRatio(
                  data?.period?.depositor_count || 0,
                  data?.period?.signups || 0,
                  "signups",
                )}
                testId="funnel-signup-deposit"
              />
              <FunnelRow
                label="Deposit → First Invest"
                pct={data?.funnel?.deposit_to_invest_pct || 0}
                caption={_captionRatio(
                  data?.period?.investor_count || 0,
                  data?.period?.depositor_count || 0,
                  "depositors",
                )}
                testId="funnel-deposit-invest"
              />
              <FunnelRow
                label="Signup → Invest (end-to-end)"
                pct={data?.funnel?.signup_to_invest_pct || 0}
                caption={_captionRatio(
                  data?.period?.investor_count || 0,
                  data?.period?.signups || 0,
                  "signups",
                )}
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

          <CohortRetentionCard cohorts={cohorts} loading={cohortLoading} />
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

// caption helper — avoid confusing "N / 0" when denominator is 0 in the period
function _captionRatio(num, den, unitLabel) {
  if ((den || 0) === 0) {
    return `${num} invested — no prior ${unitLabel} in window`;
  }
  return `${num} / ${den} ${unitLabel}`;
}

// ─── Weekly digest trigger button ──────────────────────────────────────────
function WeeklyDigestButton() {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");

  const send = async () => {
    setState("sending");
    setMsg("");
    try {
      const r = await api.post("/admin/cohort-digest/send-me-now");
      const status = r.data?.delivery?.status || "logged";
      const provider = r.data?.delivery?.provider || "mock";
      setState("sent");
      setMsg(
        provider === "mock"
          ? "Logged (mock mode — set RESEND_API_KEY to send for real)"
          : `Sent via ${provider}`,
      );
      setTimeout(() => {
        setState("idle");
        setMsg("");
      }, 6000);
    } catch (e) {
      setState("error");
      setMsg(e?.response?.data?.detail || "Failed to send");
      setTimeout(() => {
        setState("idle");
        setMsg("");
      }, 6000);
    }
  };

  const busy = state === "sending";
  const label =
    state === "sending"
      ? "Sending…"
      : state === "sent"
      ? "Sent ✓"
      : state === "error"
      ? "Retry"
      : "Email me this digest";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={busy}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition ${
          state === "sent"
            ? "bg-emerald-600 text-white"
            : state === "error"
            ? "bg-rose-600 text-white"
            : "bg-brand text-white hover:bg-brand-dark"
        } disabled:opacity-60`}
        data-testid="cohort-digest-send-btn"
      >
        <Mail className="w-3.5 h-3.5" /> {label}
      </button>
      {msg && (
        <div
          className="text-[10px] text-ink-muted max-w-[220px] text-right"
          data-testid="cohort-digest-status-msg"
        >
          {msg}
        </div>
      )}
    </div>
  );
}
function CohortRetentionCard({ cohorts, loading }) {
  if (loading) {
    return (
      <div className="af-card p-6" data-testid="cohort-retention-card">
        <div className="text-ink-muted text-sm">Loading cohort retention…</div>
      </div>
    );
  }
  if (!cohorts) {
    return (
      <div className="af-card p-6" data-testid="cohort-retention-card">
        <div className="text-ink-muted text-sm">
          Cohort retention unavailable.
        </div>
      </div>
    );
  }

  const milestones = cohorts.milestones || ["W+1", "W+2", "W+4", "W+8"];
  const rows = cohorts.cohorts || [];
  const overall = cohorts.overall || {};

  // Heat color based on pct — soft emerald scale
  const cellBg = (pct, eligible) => {
    if (!eligible) return "bg-zinc-50 text-zinc-300";
    if (pct >= 40) return "bg-emerald-600 text-white";
    if (pct >= 25) return "bg-emerald-500 text-white";
    if (pct >= 15) return "bg-emerald-400 text-white";
    if (pct >= 5) return "bg-emerald-200 text-emerald-900";
    if (pct > 0) return "bg-emerald-100 text-emerald-900";
    return "bg-zinc-50 text-zinc-400";
  };

  return (
    <div className="af-card p-6" data-testid="cohort-retention-card">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-heading font-bold text-ink flex items-center gap-2">
            <LineChart className="w-4 h-4 text-brand" /> Investor cohort
            retention
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            Of investors who signed up in each week, what % had invested by W+1,
            W+2, W+4, W+8. Greyed cells haven't matured yet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeeklyDigestButton />
          <div className="text-right text-[11px] text-ink-muted">
            Window: last {cohorts.weeks} weeks ·{" "}
            <span className="font-semibold text-ink">
              {cohorts.total_signups} investor signups
            </span>
          </div>
        </div>
      </div>

      {/* Overall bar */}
      <div
        className="grid grid-cols-4 gap-2 mb-4"
        data-testid="cohort-overall-row"
      >
        {milestones.map((m) => {
          const o = overall[m] || { pct: 0, count: 0, eligible_size: 0 };
          return (
            <div
              key={m}
              className="rounded-xl border border-zinc-200 p-3 bg-white"
              data-testid={`cohort-overall-${m}`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                Overall {m}
              </div>
              <div className="font-heading font-extrabold text-xl text-ink mt-1">
                {o.pct}%
              </div>
              <div className="text-[11px] text-ink-muted">
                {o.count} of {o.eligible_size} investors
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="py-2 pr-4 font-bold">Cohort</th>
              <th className="py-2 pr-4 font-bold text-right">Size</th>
              {milestones.map((m) => (
                <th
                  key={m}
                  className="py-2 px-2 font-bold text-center"
                  data-testid={`cohort-header-${m}`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + milestones.length}
                  className="py-6 text-center text-ink-muted text-sm"
                >
                  No investor signups in this window yet.
                </td>
              </tr>
            )}
            {rows.map((c, idx) => (
              <tr
                key={c.week_start}
                className="border-t border-zinc-100"
                data-testid={`cohort-row-${idx}`}
              >
                <td className="py-2 pr-4 font-semibold text-ink">
                  Week of {c.label}
                </td>
                <td className="py-2 pr-4 text-right text-ink-soft">
                  {c.size}
                </td>
                {milestones.map((m) => {
                  const cell = c.retention?.[m] || {
                    pct: 0,
                    count: 0,
                    eligible: false,
                  };
                  return (
                    <td
                      key={m}
                      className="py-1 px-1"
                      data-testid={`cohort-cell-${idx}-${m}`}
                    >
                      <div
                        className={`rounded-lg text-center font-semibold text-xs py-2 ${cellBg(
                          cell.pct,
                          cell.eligible,
                        )}`}
                        title={
                          cell.eligible
                            ? `${cell.count} of ${c.size} invested within ${m}`
                            : "Cohort hasn't matured to this milestone yet"
                        }
                      >
                        {cell.eligible ? `${cell.pct}%` : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 text-[11px] text-ink-muted">
        <span>Heat scale:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> 1–4%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> 5–14%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> 15–24%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> 25–39%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> 40%+
        </span>
      </div>
    </div>
  );
}
