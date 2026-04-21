import { useEffect, useState } from "react";
import { CheckCircle2, Truck, MapPin, Sprout } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

const COUNTRY_FLAG = { NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", CI: "🇨🇮" };

function timeAgo(s) {
  if (s < 60) return `${Math.max(1, s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_ICON = {
  escrow_funded: { Ic: CheckCircle2, label: "Escrow funded", tone: "text-brand" },
  in_logistics: { Ic: Truck, label: "In logistics", tone: "text-blue-600" },
  in_transit: { Ic: Truck, label: "In transit", tone: "text-blue-600" },
  delivered: { Ic: CheckCircle2, label: "Delivered", tone: "text-brand" },
  completed: { Ic: CheckCircle2, label: "Paid out", tone: "text-brand" },
};

function DealCard({ d }) {
  const m = STATUS_ICON[d.status] || STATUS_ICON.escrow_funded;
  const Ic = m.Ic;
  return (
    <div className="flex-shrink-0 w-[320px] af-card p-4 flex items-center gap-3 mx-2" data-testid={`deal-${d.id}`}>
      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center flex-shrink-0">
        <Sprout className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-heading font-bold text-ink truncate">
            {d.crop} · {d.quantity_kg.toLocaleString()}kg
          </div>
          <span className="text-xs">{COUNTRY_FLAG[d.country] || "🌍"}</span>
        </div>
        <div className="text-xs text-ink-muted flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3" /> {d.origin} → {d.destination}
        </div>
        <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1 ${m.tone}`}>
          <Ic className="w-3 h-3" /> {m.label} · {timeAgo(d.seconds_ago)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-heading font-extrabold text-ink text-sm">{fmtMoney(d.total, d.currency)}</div>
        <div className="text-[10px] text-ink-muted">{d.farmer_alias}</div>
      </div>
    </div>
  );
}

export default function RecentDealsFeed() {
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    const load = () => api.get("/stats/recent-deals").then((r) => setDeals(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);
  if (deals.length === 0) return null;
  // Duplicate for seamless marquee loop
  const track = [...deals, ...deals];
  return (
    <section className="py-14 border-y border-zinc-100 bg-white" data-testid="recent-deals-feed">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
          </span>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Recently on AgriFlow</div>
          <span className="af-chip text-[10px]">Live · anonymised</span>
        </div>
      </div>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track flex">
          {track.map((d, i) => (
            <DealCard key={`${d.id}-${i}`} d={d} />
          ))}
        </div>
      </div>
    </section>
  );
}
