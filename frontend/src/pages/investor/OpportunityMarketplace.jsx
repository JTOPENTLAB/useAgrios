import { useEffect, useState } from "react";
import { Search, LineChart as LineChartIcon } from "lucide-react";
import api from "@/lib/api";
import TrustStrip from "@/components/TrustStrip";
import RecentlyMaturedCarousel from "@/components/RecentlyMaturedCarousel";
import { OpportunityCard } from "./InvestorHome";

export default function OpportunityMarketplace() {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const params = {};
    if (risk) params.risk_band = risk;
    const r = await api.get("/opportunities", { params });
    setOpps(r.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [risk]); // eslint-disable-line

  const filtered = opps.filter((o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      o.title.toLowerCase().includes(s) ||
      (o.crop || "").toLowerCase().includes(s) ||
      (o.region || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6" data-testid="opportunity-marketplace">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Investor marketplace
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">
          Open funding opportunities
        </h1>
        <p className="text-ink-muted mt-1">
          Verified farmers. Admin-reviewed. Transparent returns.
        </p>
      </div>

      <TrustStrip />

      <RecentlyMaturedCarousel limit={6} />

      {/* Filters */}
      <div className="af-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="af-input pl-10"
            placeholder="Search crop, region, farm name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="opp-search"
          />
        </div>
        <div className="flex gap-2" data-testid="opp-risk-filter">
          {["", "A", "B", "C"].map((b) => (
            <button
              key={b || "all"}
              onClick={() => setRisk(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                risk === b
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
              }`}
              data-testid={`risk-${b || "all"}`}
            >
              {b ? `Risk ${b}` : "All risk"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="af-card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-zinc-100 rounded w-1/2" />
              <div className="h-6 bg-zinc-100 rounded w-full" />
              <div className="h-2 bg-zinc-100 rounded" />
              <div className="h-3 bg-zinc-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="af-card p-10 text-center" data-testid="opp-empty">
          <LineChartIcon className="w-10 h-10 text-ink-muted mx-auto mb-2" />
          <div className="font-heading font-bold text-ink">
            No opportunities match your filters
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Check back soon — new farm cycles are listed every week.
          </p>
        </div>
      ) : (
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="opp-grid"
        >
          {filtered.map((o) => (
            <OpportunityCard key={o.id} opp={o} />
          ))}
        </div>
      )}
    </div>
  );
}
