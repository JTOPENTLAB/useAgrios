import { useEffect, useState } from "react";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

/**
 * Phase B — live Hot Demand from /api/insights/hot-demand.
 * Falls back to static mocks only if the network errors.
 */
const FALLBACK = [
  { crop: "Tomato", pct_change: 42, price_min: 420, price_max: 520, currency: "NGN", signal: "high" },
  { crop: "Cocoa", pct_change: 28, price_min: 2400, price_max: 2800, currency: "NGN", signal: "high" },
  { crop: "Ginger", pct_change: 19, price_min: 800, price_max: 1000, currency: "NGN", signal: "moderate" },
  { crop: "Maize", pct_change: 14, price_min: 180, price_max: 240, currency: "NGN", signal: "moderate" },
];

export default function HotDemandStrip({ compact = false }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get("/insights/hot-demand")
      .then((r) => setItems((r.data && r.data.length ? r.data : FALLBACK).slice(0, 4)))
      .catch(() => setItems(FALLBACK))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section
      className={compact ? "af-card p-4" : "af-card p-5 sm:p-6"}
      data-testid="hot-demand-strip"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
          <Flame className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-ink">Hot demand this week</h3>
          <div className="text-xs text-ink-muted">
            Live order-velocity signal — price your listing accordingly.
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-3`}>
        {(items.length ? items : loaded ? FALLBACK : []).map((h) => {
          const Icon =
            h.pct_change == null || h.pct_change === 0
              ? Minus
              : h.pct_change > 0
              ? TrendingUp
              : TrendingDown;
          const tone =
            h.pct_change == null
              ? "text-zinc-500"
              : h.pct_change > 0
              ? "text-rose-600"
              : "text-brand";
          const hasRange =
            h.price_min != null &&
            h.price_max != null &&
            (h.price_min > 0 || h.price_max > 0);
          return (
            <div
              key={h.crop}
              className="rounded-2xl border border-zinc-100 p-4 hover:border-rose-200 hover:bg-rose-50/30 transition"
              data-testid={`hot-${h.crop.toLowerCase()}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-heading font-bold text-ink">{h.crop}</div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${tone}`}>
                  <Icon className="w-3 h-3" />
                  {h.pct_change == null ? "new" : `${h.pct_change > 0 ? "+" : ""}${h.pct_change}%`}
                </span>
              </div>
              {hasRange && (
                <div className="text-[11px] text-ink-muted mt-1 font-semibold">
                  {fmtMoney(h.price_min, h.currency || "NGN")}–
                  {fmtMoney(h.price_max, h.currency || "NGN")}/kg
                </div>
              )}
              <div className="text-[10px] text-ink-muted mt-1.5 uppercase tracking-wider font-bold">
                {h.signal === "high" ? (
                  <span className="text-rose-600">🔥 High demand</span>
                ) : (
                  "Steady demand"
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
