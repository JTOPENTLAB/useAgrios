import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, Flame, Grid3x3 } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function MarketIntel() {
  const { user } = useAuth();
  const [crops, setCrops] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [trend, setTrend] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const currency = user?.currency || "NGN";

  // Load hot demand for crop list
  useEffect(() => {
    api.get("/insights/hot-demand").then((r) => {
      const items = r.data?.items || [];
      setCrops(items.slice(0, 8));
      if (items.length && !selectedCrop) setSelectedCrop(items[0].crop);
    });
    api.get("/market/demand-heatmap?days=60").then((r) => setHeatmap(r.data));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedCrop) return;
    setLoadingTrend(true);
    api
      .get(`/market/price-trend?crop=${encodeURIComponent(selectedCrop)}&days=90`)
      .then((r) => setTrend(r.data))
      .finally(() => setLoadingTrend(false));
  }, [selectedCrop]);

  const heatCellColor = (gmv) => {
    if (!heatmap?.max_gmv || gmv === 0) return "bg-zinc-50 text-ink-muted";
    const intensity = gmv / heatmap.max_gmv;
    if (intensity > 0.75) return "bg-brand text-white";
    if (intensity > 0.5) return "bg-brand/70 text-white";
    if (intensity > 0.25) return "bg-brand/40 text-white";
    if (intensity > 0.1) return "bg-brand/20 text-brand";
    return "bg-brand/10 text-brand";
  };

  return (
    <div className="space-y-6" data-testid="market-intel-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Bloomberg for agriculture
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">
          Market intelligence
        </h1>
        <p className="text-ink-muted mt-1">
          Price trends, demand heatmaps, and regional signals — the data behind
          every smart trade decision.
        </p>
      </div>

      {/* Crop switcher + trend */}
      <div className="af-card p-6" data-testid="price-trend-card">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <h3 className="font-heading font-bold flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-brand" /> Price trend
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Median paid price per kg, last 90 days.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="crop-switcher">
            {crops.map((c) => (
              <button
                key={c.crop}
                onClick={() => setSelectedCrop(c.crop)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  selectedCrop === c.crop
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
                }`}
                data-testid={`crop-btn-${c.crop}`}
              >
                {c.crop}
              </button>
            ))}
          </div>
        </div>

        {/* Snapshot stats */}
        {trend && (
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <StatTile
              label="Active listings"
              value={trend.snapshot?.active_listings ?? 0}
            />
            <StatTile
              label="Min price"
              value={
                trend.snapshot?.min_price
                  ? fmtMoney(trend.snapshot.min_price, currency)
                  : "—"
              }
            />
            <StatTile
              label="Median price"
              value={
                trend.snapshot?.median_price
                  ? fmtMoney(trend.snapshot.median_price, currency)
                  : "—"
              }
              highlight
            />
            <StatTile
              label="Week-over-week"
              value={
                trend.wow_pct === null || trend.wow_pct === undefined
                  ? "—"
                  : `${trend.wow_pct > 0 ? "+" : ""}${trend.wow_pct}%`
              }
              tone={
                trend.wow_pct > 0
                  ? "up"
                  : trend.wow_pct < 0
                  ? "down"
                  : "neutral"
              }
            />
          </div>
        )}

        {loadingTrend ? (
          <div className="py-10 text-center text-ink-muted">Loading…</div>
        ) : !trend?.series?.length ? (
          <div className="py-10 text-center text-ink-muted">
            Not enough order history for {selectedCrop} yet — trend will appear
            as deals get completed.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend.series}>
              <defs>
                <linearGradient id="pxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F5132" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0F5132" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(v, name) =>
                  name === "median_price" ? fmtMoney(v, currency) : v
                }
              />
              <Area
                type="monotone"
                dataKey="median_price"
                stroke="#0F5132"
                strokeWidth={2}
                fill="url(#pxGrad)"
                name="Median price"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Demand Heatmap */}
      <div className="af-card p-6" data-testid="demand-heatmap-card">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h3 className="font-heading font-bold flex items-center gap-2 text-lg">
              <Grid3x3 className="w-5 h-5 text-brand" /> Demand heatmap
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Region × crop GMV intensity, last 60 days. Darker = more demand.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-ink-muted">
            <span>Low</span>
            <div className="flex">
              <span className="w-4 h-4 bg-brand/10" />
              <span className="w-4 h-4 bg-brand/20" />
              <span className="w-4 h-4 bg-brand/40" />
              <span className="w-4 h-4 bg-brand/70" />
              <span className="w-4 h-4 bg-brand" />
            </div>
            <span>High</span>
          </div>
        </div>

        {!heatmap?.rows?.length ? (
          <div className="py-10 text-center text-ink-muted">
            Heatmap fills in as orders flow. Come back after the first batch of
            completed deliveries.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-ink-muted text-xs uppercase tracking-wider">
                    Region
                  </th>
                  {heatmap.crops.map((c) => (
                    <th
                      key={c}
                      className="text-center px-2 py-2 font-semibold text-ink-muted text-xs uppercase tracking-wider"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.region}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      {row.region}
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.crop}
                        className={`px-2 py-3 text-center text-xs font-bold transition ${heatCellColor(
                          cell.gmv,
                        )}`}
                        title={`${cell.gmv.toLocaleString()} · ${cell.orders} orders`}
                      >
                        {cell.gmv > 0 ? cell.orders : "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hot crops quick strip */}
      <div className="af-card p-6" data-testid="hot-crops-strip">
        <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-gold-ink" /> Hot crops right now
        </h3>
        {crops.length === 0 ? (
          <p className="text-ink-muted text-sm">Gathering signals…</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {crops.slice(0, 8).map((c) => (
              <button
                key={c.crop}
                onClick={() => setSelectedCrop(c.crop)}
                className="text-left p-4 rounded-xl bg-gradient-to-br from-gold/5 to-white border border-gold/20 hover:border-gold/50 transition"
              >
                <div className="font-heading font-bold text-ink">{c.crop}</div>
                <div className="text-xs text-ink-muted mt-1">
                  {c.orders_30d || c.orders_count || 0} orders · 30d
                </div>
                {typeof c.wow_pct === "number" && (
                  <div
                    className={`text-xs font-semibold mt-1 ${
                      c.wow_pct > 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {c.wow_pct > 0 ? "+" : ""}
                    {c.wow_pct}% WoW
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, highlight, tone }) {
  const toneCls =
    tone === "up"
      ? "text-emerald-700"
      : tone === "down"
      ? "text-red-600"
      : highlight
      ? "text-brand"
      : "text-ink";
  return (
    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className={`font-heading font-extrabold text-lg mt-1 ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
