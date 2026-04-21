import { useEffect, useState } from "react";
import { TrendingUp, Sparkles } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

export default function RecentlyMaturedCarousel({ limit = 6 }) {
  const [items, setItems] = useState([]);
  const [realCount, setRealCount] = useState(0);

  useEffect(() => {
    api
      .get(`/opportunities/recently-matured?limit=${limit}`)
      .then((r) => {
        setItems(r.data.items || []);
        setRealCount(r.data.real_count || 0);
      })
      .catch(() => {
        setItems([]);
        setRealCount(0);
      });
  }, [limit]);

  if (!items || items.length === 0) return null;

  return (
    <div className="af-card p-6" data-testid="recently-matured-carousel">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink">Recently matured</h3>
            <p className="text-xs text-ink-muted">
              {realCount > 0
                ? "Cycles that reached maturity and paid investors back."
                : "Preview — sample of cycles nearing maturity."}
            </p>
          </div>
        </div>
        {realCount === 0 && (
          <span className="text-[10px] font-bold uppercase text-ink-muted bg-zinc-100 rounded-full px-2 py-0.5">
            Demo preview
          </span>
        )}
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 af-snap-scroll"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((o) => (
          <div
            key={o.id}
            className="flex-shrink-0 w-[280px] p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100"
            style={{ scrollSnapAlign: "start" }}
            data-testid={`matured-card-${o.id}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {o.crop} · {o.region || "—"}
            </div>
            <h4 className="font-heading font-bold text-ink mt-1 line-clamp-2 min-h-[44px]">
              {o.title}
            </h4>
            <div className="mt-3 pt-3 border-t border-emerald-100 flex items-end justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-bold text-ink-muted">
                  Realized
                </div>
                <div className="font-heading font-extrabold text-xl text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {(o.realized_return_pct ?? 0).toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-ink-muted">
                  Raised
                </div>
                <div className="font-heading font-bold text-sm text-ink">
                  {fmtMoney(o.funding_target || 0, o.currency || "NGN")}
                </div>
                <div className="text-[10px] text-ink-muted">
                  {o.investor_count || 0} investors
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
