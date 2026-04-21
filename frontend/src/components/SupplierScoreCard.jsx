import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import SupplierBadge from "@/components/SupplierBadge";

/**
 * Compact supplier performance dashboard card — shown on Farmer home.
 * Drives lock-in: farmers see their score, badges, and top metrics at a glance.
 */
export default function SupplierScoreCard({ farmerId }) {
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    if (!farmerId) return;
    api
      .get(`/suppliers/${farmerId}/performance`)
      .then((r) => setPerf(r.data))
      .catch(() => {});
  }, [farmerId]);

  if (!perf) return null;

  const bandCls = {
    A: "from-emerald-600 to-brand",
    B: "from-brand to-brand-dark",
    C: "from-amber-500 to-gold",
    D: "from-zinc-500 to-zinc-700",
  }[perf.band] || "from-brand to-brand-dark";

  return (
    <div
      className="af-card overflow-hidden"
      data-testid="supplier-score-card"
    >
      <div className={`bg-gradient-to-br ${bandCls} text-white p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Performance score
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="font-heading font-extrabold text-5xl">
                {perf.score}
              </div>
              <div className="font-heading font-extrabold text-xl opacity-80">
                / 100
              </div>
              <div className="ml-2 rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-xs font-bold">
                Band {perf.band}
              </div>
              {typeof perf.score_delta_30d === "number" && perf.score_delta_30d !== 0 && (
                <div
                  className={`ml-1 inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 ${
                    perf.score_delta_30d > 0
                      ? "bg-emerald-400/25 text-emerald-50"
                      : "bg-red-400/25 text-red-50"
                  }`}
                  data-testid="score-delta-30d"
                >
                  {perf.score_delta_30d > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {perf.score_delta_30d > 0 ? "+" : ""}
                  {perf.score_delta_30d} · 30d
                </div>
              )}
            </div>
          </div>
        </div>
        {perf.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {perf.badges.map((b) => (
              <span key={b} className="inline-block">
                <SupplierBadge type={b} compact />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-5 grid grid-cols-3 gap-3">
        <Metric
          label="Orders done"
          value={perf.metrics.completed_orders}
        />
        <Metric
          label="Repeat buyers"
          value={perf.metrics.repeat_buyer_count}
        />
        <Metric
          label="Avg rating"
          value={
            perf.metrics.avg_rating !== null
              ? `${perf.metrics.avg_rating}★`
              : "—"
          }
        />
      </div>
      <div className="px-5 pb-5">
        <Link
          to="/app/farmer/earnings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
          data-testid="score-open-earnings"
        >
          See full earnings report <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="font-heading font-extrabold text-lg text-ink mt-0.5">
        {value}
      </div>
    </div>
  );
}
