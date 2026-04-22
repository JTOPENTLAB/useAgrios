import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Clock, Sparkles } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function SimilarOpportunities({ oppId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!oppId) return;
    api
      .get(`/opportunities/${oppId}/similar?limit=3`)
      .then((r) => setRows(r.data.items || []))
      .finally(() => setLoading(false));
  }, [oppId]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="af-card p-5" data-testid="similar-opportunities">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold-ink grid place-items-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-ink">You may also like</h3>
          <p className="text-xs text-ink-muted">
            Similar crop, region, or return profile.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {rows.map((o) => {
          const pct =
            o.funding_target > 0
              ? Math.min(100, Math.round((o.funding_raised / o.funding_target) * 100))
              : 0;
          return (
            <Link
              key={o.id}
              to={`/app/opportunities/${o.id}`}
              className="af-card af-card-hover p-4 flex flex-col gap-2"
              data-testid={`similar-${o.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand">
                  {o.crop} · {o.region}
                </div>
                <span
                  className={`text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 border ${
                    RISK_CLS[o.risk_band] || RISK_CLS.B
                  }`}
                >
                  {o.risk_band}
                </span>
              </div>
              <div className="font-heading font-bold text-ink text-sm line-clamp-2 min-h-[40px]">
                {o.title}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {o.target_return_pct}%
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {o.duration_months}mo
                </span>
              </div>
              <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-ink-muted">
                <span>{pct}% funded</span>
                <span>min {fmtMoney(o.min_ticket, o.currency)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
