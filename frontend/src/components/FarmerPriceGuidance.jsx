import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, TrendingDown, CheckCircle2, ArrowRight } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

/**
 * Price guidance + suggested-crops for the farmer dashboard.
 * Pulls /api/recommendations/for-farmer.
 */
export default function FarmerPriceGuidance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/recommendations/for-farmer")
      .then((r) => setData(r.data))
      .catch(() => setData({ suggest_crops: [], price_guidance: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return null;

  const hasGuidance = data.price_guidance && data.price_guidance.length > 0;
  const hasSuggestions = data.suggest_crops && data.suggest_crops.length > 0;

  if (!hasGuidance && !hasSuggestions) return null;

  return (
    <section className="af-card p-6" data-testid="farmer-recs">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-ink">Smart suggestions</h3>
          <div className="text-xs text-ink-muted">AI-lite pricing &amp; crop recommendations for you</div>
        </div>
      </div>

      {hasGuidance && (
        <div className="space-y-2.5" data-testid="price-guidance">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Your price vs market
          </div>
          {data.price_guidance.map((g) => {
            const isLower = g.suggestion === "raise";
            const isHigher = g.suggestion === "lower";
            const tone = isLower
              ? "bg-brand/5 border-brand/30 text-brand"
              : isHigher
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-zinc-50 border-zinc-200 text-ink-muted";
            const label = isLower
              ? "Room to raise"
              : isHigher
              ? "Priced above market"
              : "Priced fairly";
            const Icon = isLower ? TrendingUp : isHigher ? TrendingDown : CheckCircle2;
            return (
              <div
                key={g.crop}
                className={`rounded-xl border p-3 flex items-center gap-3 ${tone}`}
                data-testid={`guidance-${g.crop.toLowerCase()}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink">{g.crop}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    You: <span className="font-bold">{fmtMoney(g.your_price, "NGN")}</span> · Median:{" "}
                    <span className="font-bold">{fmtMoney(g.market_median, "NGN")}</span> · Top
                    quartile: <span className="font-bold">{fmtMoney(g.market_p75, "NGN")}</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {hasSuggestions && (
        <div className={`${hasGuidance ? "mt-5 pt-5 border-t border-zinc-100" : ""}`} data-testid="suggest-crops">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
            Hot crops you're not yet listing
          </div>
          <div className="flex gap-2 flex-wrap">
            {data.suggest_crops.map((s) => (
              <Link
                key={s.crop}
                to="/app/farmer/listings/new"
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 transition"
                data-testid={`suggest-${s.crop.toLowerCase()}`}
              >
                🔥 {s.crop}
                {s.pct_change != null && (
                  <span className="text-[10px] opacity-70">
                    {s.pct_change > 0 ? "+" : ""}
                    {s.pct_change}%
                  </span>
                )}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
