import { useEffect, useState } from "react";
import { Eye, Users, Package, Zap } from "lucide-react";
import api from "@/lib/api";

/**
 * Live marketplace liquidity for a listing — "X buyers viewing · Y orders this week · Z suppliers"
 * Creates the "lots is happening right now" feeling that drives urgency.
 */
export default function LiquiditySignals({ listingId, variant = "default" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await api.get(`/liquidity/listing/${listingId}`);
        if (active) setData(r.data);
      } catch {
        /* silent */
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [listingId]);

  if (loading || !data) return null;

  const Pill = ({ icon: Icon, label, value, tone = "default" }) => (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
        tone === "hot"
          ? "bg-gold/10 text-gold-ink border border-gold/30"
          : "bg-brand/5 text-brand border border-brand/15"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-bold">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="liquidity-signals-inline"
      >
        {data.recent_viewers > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {data.recent_viewers} viewing now
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="af-card p-4 bg-gradient-to-br from-brand/5 via-white to-gold/5 border border-brand/10"
      data-testid="liquidity-signals"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </div>
        <span className="font-heading font-bold text-sm text-ink">
          Live activity
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill
          icon={Eye}
          value={data.recent_viewers}
          label="viewing now"
          tone="hot"
        />
        <Pill
          icon={Zap}
          value={data.orders_completed_this_week}
          label="orders this week"
        />
        <Pill
          icon={Users}
          value={data.active_suppliers}
          label={`supplier${data.active_suppliers === 1 ? "" : "s"} for this crop`}
        />
        <Pill
          icon={Package}
          value={data.saves_total}
          label="buyers saved this"
        />
      </div>
    </div>
  );
}
