import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Users,
  Repeat,
  MapPin,
  Package,
  Wallet as WalletIcon,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function FarmerEarnings() {
  const { user } = useAuth();
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/farmer/earnings?days=${days}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [days]);

  const currency = user?.currency || "NGN";

  return (
    <div className="space-y-6" data-testid="farmer-earnings-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Earnings intelligence
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Your revenue engine
          </h1>
          <p className="text-ink-muted mt-1">
            Weekly income trend, best crops, best regions, repeat buyers — all
            in one place.
          </p>
        </div>
        <div className="flex gap-2" data-testid="earnings-period-switch">
          {[30, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                days === d
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
              }`}
              data-testid={`earnings-period-${d}`}
            >
              Last {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi
          icon={WalletIcon}
          label="Total earnings"
          value={fmtMoney(data?.total_gmv || 0, currency)}
          tone="brand"
        />
        <Kpi
          icon={Package}
          label="Orders released"
          value={data?.total_orders || 0}
        />
        <Kpi
          icon={Repeat}
          label="Repeat buyers"
          value={data?.repeat_buyers?.length || 0}
          tone="gold"
        />
      </div>

      {/* Weekly series chart */}
      <div className="af-card p-6">
        <h3 className="font-heading font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-brand" />
          Weekly earnings
        </h3>
        {loading ? (
          <div className="py-10 text-center text-ink-muted">Loading…</div>
        ) : (data?.weekly_series || []).length === 0 ? (
          <div className="py-10 text-center text-ink-muted">
            No released orders yet. Complete a delivery to start seeing your
            earnings curve.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.weekly_series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(v, name) =>
                  name === "gmv" ? fmtMoney(v, currency) : v
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gmv"
                name="Earnings"
                stroke="#0F5132"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Best crops */}
        <div className="af-card p-6" data-testid="best-crops-card">
          <h3 className="font-heading font-bold mb-4">Top earning crops</h3>
          {(data?.best_crops || []).length === 0 ? (
            <p className="text-ink-muted text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.best_crops} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis type="number" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="crop"
                  fontSize={12}
                  width={90}
                />
                <Tooltip formatter={(v) => fmtMoney(v, currency)} />
                <Bar dataKey="gmv" fill="#0F5132" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Best regions */}
        <div className="af-card p-6" data-testid="best-regions-card">
          <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand" /> Top delivery regions
          </h3>
          {(data?.best_regions || []).length === 0 ? (
            <p className="text-ink-muted text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.best_regions.map((r, i) => (
                <div
                  key={r.region}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-ink truncate">
                      {r.region}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-brand">
                      {fmtMoney(r.gmv, currency)}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {r.orders} order{r.orders === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Repeat buyers */}
      <div className="af-card p-6" data-testid="repeat-buyers-card">
        <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand" /> Your repeat buyers
        </h3>
        {(data?.repeat_buyers || []).length === 0 ? (
          <p className="text-ink-muted text-sm">
            When a buyer orders from you twice, they show up here. Keep quality
            high — repeat buyers are your moat.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.repeat_buyers.map((b) => (
              <div
                key={b.buyer_id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100"
              >
                <div className="font-semibold text-ink truncate">{b.name}</div>
                <span className="af-chip bg-gold/10 text-gold-ink">
                  {b.orders}× orders
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default" }) {
  const tones = {
    brand: "from-brand to-brand-dark text-white",
    gold: "from-gold/90 to-amber-500 text-white",
    default: "bg-white text-ink",
  };
  const isGradient = tone !== "default";
  return (
    <div
      className={`af-card p-5 ${
        isGradient
          ? `bg-gradient-to-br ${tones[tone]} border-0`
          : tones.default
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="mt-2 font-heading font-extrabold text-2xl">{value}</div>
    </div>
  );
}
