import { useEffect, useState } from "react";
import axios from "axios";
import { TrendingUp, Users, Clock, ShoppingCart } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function fmtNGN(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
  return `₦${v.toLocaleString()}`;
}

export default function LandingPulseTicker() {
  const [m, setM] = useState(null);

  useEffect(() => {
    const load = () =>
      axios
        .get(`${BACKEND_URL}/api/stats/landing-pulse`)
        .then((r) => setM(r.data.metrics))
        .catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  const stats = [
    {
      icon: TrendingUp,
      label: "invested this week",
      value: m ? fmtNGN(m.invested_this_week) : "—",
      testId: "pulse-invested",
    },
    {
      icon: Users,
      label: "new investors this week",
      value: m ? m.new_investors_this_week : "—",
      testId: "pulse-investors",
    },
    {
      icon: Clock,
      label: "cycles closing soon",
      value: m ? m.cycles_closing_soon : "—",
      testId: "pulse-closing",
    },
    {
      icon: ShoppingCart,
      label: "produce moved this week",
      value: m ? fmtNGN(m.gmv_this_week) : "—",
      testId: "pulse-gmv",
    },
  ];

  return (
    <div
      className="mt-6 relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70 backdrop-blur"
      data-testid="landing-pulse-ticker"
    >
      <div className="absolute top-3 left-4 flex items-center gap-1.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-emerald-200/70">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.testId}
              className="bg-emerald-50/80 p-4 sm:p-5"
              data-testid={s.testId}
            >
              <div className="flex items-center gap-2 text-emerald-700">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 mt-1.5 tabular-nums">
                {s.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
