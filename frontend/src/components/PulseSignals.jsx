import { useEffect, useState } from "react";
import axios from "axios";
import { TrendingUp, Users, Clock } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function fmtNGN(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
  return `₦${v.toLocaleString()}`;
}

export default function PulseSignals({ refreshMs = 10000 }) {
  const [m, setM] = useState(null);

  useEffect(() => {
    const load = () =>
      axios
        .get(`${BACKEND_URL}/api/stats/landing-pulse`)
        .then((r) => setM(r.data.metrics))
        .catch(() => {});
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  const stats = [
    { icon: TrendingUp, label: "invested this week", value: m ? fmtNGN(m.invested_this_week) : "—", testId: "pulse-s-invested" },
    { icon: Users, label: "new investors joined", value: m ? m.new_investors_this_week : "—", testId: "pulse-s-investors" },
    { icon: Clock, label: "cycles closing soon", value: m ? m.cycles_closing_soon : "—", testId: "pulse-s-closing" },
  ];

  return (
    <div className="af-card p-4 flex items-center gap-4 flex-wrap" data-testid="pulse-signals">
      <div className="flex items-center gap-1.5 pr-3 border-r border-zinc-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Live
        </span>
      </div>
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.testId} className="flex items-center gap-2" data-testid={s.testId}>
            <Icon className="w-3.5 h-3.5 text-ink-muted" />
            <div>
              <div className="font-heading font-extrabold text-lg text-ink tabular-nums leading-none">
                {s.value}
              </div>
              <div className="text-[10px] text-ink-muted uppercase tracking-wider">
                {s.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
