import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Cloud, Droplets, Thermometer, TrendingUp } from "lucide-react";
import api, { fmtNGN } from "@/lib/api";

const COLORS = ["#0F5132", "#198754", "#F59E0B", "#D97706", "#3B82F6", "#10B981"];

export default function Analytics() {
  const [prices, setPrices] = useState([]);
  const [demand, setDemand] = useState([]);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/analytics/prices"), api.get("/analytics/demand"), api.get("/analytics/weather")]).then(
      ([p, d, w]) => {
        setPrices(p.data);
        setDemand(d.data);
        setWeather(w.data);
      }
    );
  }, []);

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Intelligence</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Market analytics</h1>
        <p className="text-ink-muted mt-1">Live pricing, demand signals, and regional weather for smarter decisions.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="af-card p-6">
          <h3 className="font-heading font-bold flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-brand" /> Average price per kg</h3>
          <p className="text-xs text-ink-muted mb-4">Across all active listings.</p>
          {prices.length === 0 ? (
            <div className="py-10 text-center text-ink-muted">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={prices} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="crop" stroke="#71717A" fontSize={12} />
                <YAxis stroke="#71717A" fontSize={12} tickFormatter={(v) => `₦${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7" }} formatter={(v) => fmtNGN(v)} />
                <Bar dataKey="avg_price" radius={[8, 8, 0, 0]}>
                  {prices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="af-card p-6">
          <h3 className="font-heading font-bold flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-gold-dark" /> Demand (GMV per crop)</h3>
          <p className="text-xs text-ink-muted mb-4">Total order value — what buyers are actually paying for.</p>
          {demand.length === 0 ? (
            <div className="py-10 text-center text-ink-muted">No orders yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={demand} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="crop" stroke="#71717A" fontSize={12} />
                <YAxis stroke="#71717A" fontSize={12} tickFormatter={(v) => `₦${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7" }} formatter={(v) => fmtNGN(v)} />
                <Bar dataKey="gmv" fill="#F59E0B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="af-card p-6">
        <h3 className="font-heading font-bold flex items-center gap-2 mb-4"><Cloud className="w-4 h-4 text-blue-600" /> Regional weather</h3>
        {weather && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {weather.regions.map((r) => (
              <div key={r.region} className={`rounded-2xl p-4 border ${r.alert ? "border-rose-200 bg-rose-50/50" : "border-zinc-100 bg-zinc-50"}`} data-testid={`weather-${r.region}`}>
                <div className="font-heading font-bold text-ink">{r.region}</div>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-rose-500" />{r.temp_c}°C</span>
                  <span className="flex items-center gap-1"><Droplets className="w-4 h-4 text-blue-500" />{r.rainfall_mm_7d}mm</span>
                </div>
                {r.alert && <div className="mt-2 text-xs text-rose-700 font-semibold">{r.alert}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {prices.length > 0 && (
        <div className="af-card p-6">
          <h3 className="font-heading font-bold mb-3">Crop detail</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-ink-muted font-bold tracking-wider">
              <tr className="border-b border-zinc-100">
                <th className="text-left py-2">Crop</th>
                <th className="text-right py-2">Avg ₦/kg</th>
                <th className="text-right py-2">Min</th>
                <th className="text-right py-2">Max</th>
                <th className="text-right py-2">Total qty</th>
                <th className="text-right py-2">Listings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {prices.map((p) => (
                <tr key={p.crop}>
                  <td className="py-3 font-semibold">{p.crop}</td>
                  <td className="text-right font-heading font-bold text-brand">{fmtNGN(p.avg_price)}</td>
                  <td className="text-right">{fmtNGN(p.min_price)}</td>
                  <td className="text-right">{fmtNGN(p.max_price)}</td>
                  <td className="text-right">{p.total_qty_kg.toLocaleString()}kg</td>
                  <td className="text-right">{p.listings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
