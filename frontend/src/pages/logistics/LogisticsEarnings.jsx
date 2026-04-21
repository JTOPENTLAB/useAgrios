import { useEffect, useState } from "react";
import { Truck, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LogisticsEarnings() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/logistics/earnings?days=${days}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [days]);

  const maxWeek = Math.max(1, ...((data?.weekly || []).map((w) => w.earned)));

  return (
    <div className="space-y-6" data-testid="logistics-earnings">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Logistics · Earnings
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Your earnings dashboard
          </h1>
          <p className="text-ink-muted mt-1">
            Jobs completed, money earned, on-time performance.
          </p>
        </div>
        <div className="flex gap-1" data-testid="range-toggles">
          {[30, 90, 180].map((d) => (
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
          <div className="grid sm:grid-cols-4 gap-4">
            <Kpi
              label={`Earned (${days}d)`}
              value={fmtMoney(data?.period_earned || 0, currency)}
              icon={TrendingUp}
              tone="brand"
              testId="kpi-period-earned"
            />
            <Kpi
              label="Lifetime earned"
              value={fmtMoney(data?.total_earned || 0, currency)}
              icon={Truck}
              tone="gold"
              testId="kpi-total-earned"
            />
            <Kpi
              label="Delivered jobs"
              value={String(data?.delivered_count || 0)}
              icon={CheckCircle2}
              testId="kpi-delivered"
            />
            <Kpi
              label="On-time %"
              value={`${data?.on_time_pct || 0}%`}
              icon={Clock}
              testId="kpi-ontime"
            />
          </div>

          <div className="af-card p-6">
            <h3 className="font-heading font-bold text-ink mb-3">
              Weekly earnings
            </h3>
            {(data?.weekly || []).length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-muted">
                No completed jobs in this period yet. Accept jobs from the Jobs
                board to start earning.
              </div>
            ) : (
              <div
                className="flex items-end gap-2 h-48"
                data-testid="earnings-bars"
              >
                {data.weekly.map((w) => (
                  <div
                    key={w.week}
                    className="flex-1 flex flex-col items-center justify-end gap-2 min-w-[40px]"
                  >
                    <div className="text-[10px] font-bold text-ink">
                      {fmtMoney(w.earned, currency)}
                    </div>
                    <div
                      className="w-full bg-gradient-to-t from-brand to-brand/70 rounded-t-lg"
                      style={{
                        height: `${Math.max(6, (w.earned / maxWeek) * 100)}%`,
                      }}
                      data-testid={`bar-${w.week}`}
                    />
                    <div className="text-[10px] text-ink-muted">
                      {w.week.split("-W")[1]}W
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="af-card p-4 flex items-center gap-2 text-xs text-ink-muted">
            <Truck className="w-3.5 h-3.5" />
            {data?.active_count || 0} active job{data?.active_count === 1 ? "" : "s"}{" "}
            in progress · {data?.total_jobs || 0} total assignments.
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, testId }) {
  const toneCls =
    tone === "brand"
      ? "bg-gradient-to-br from-brand to-brand-dark text-white border-0"
      : tone === "gold"
      ? "bg-gradient-to-br from-gold/90 to-amber-500 text-white border-0"
      : "bg-white text-ink";
  return (
    <div className={`af-card p-5 ${toneCls}`} data-testid={testId}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="font-heading font-extrabold text-2xl mt-2">{value}</div>
    </div>
  );
}
