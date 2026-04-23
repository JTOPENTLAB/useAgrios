import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PartyPopper, TrendingUp, Clock, Bell, ArrowRight, Sparkles } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function InvestmentSuccess() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const oppId = sp.get("id");
  const amount = Number(sp.get("amount") || 0);
  const payout = Number(sp.get("payout") || 0);
  const duration = Number(sp.get("duration") || 0);
  const currency = user?.currency || "NGN";

  const [opp, setOpp] = useState(null);

  useEffect(() => {
    if (!oppId) {
      nav("/app/portfolio", { replace: true });
      return;
    }
    api
      .get(`/opportunities/${oppId}`)
      .then((r) => setOpp(r.data))
      .catch(() => {});
  }, [oppId, nav]);

  return (
    <div className="relative overflow-hidden" data-testid="invest-success-page">
      <Confetti />
      <div className="relative max-w-2xl mx-auto text-center py-10 sm:py-16">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-white shadow-lift">
          <PartyPopper className="w-9 h-9" />
        </div>
        <h1
          className="font-heading font-extrabold text-4xl sm:text-5xl text-ink mt-6 leading-tight"
          data-testid="invest-success-title"
        >
          Your capital is now at work.
        </h1>
        <p className="text-ink-muted mt-3 text-lg max-w-lg mx-auto">
          Congrats on your first allocation. We'll keep you posted every step of
          the way.
        </p>

        <div className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
          <Stat
            icon={Sparkles}
            label="You invested"
            value={fmtMoney(amount, currency)}
            tone="brand"
            testId="success-stat-amount"
          />
          <Stat
            icon={Clock}
            label="Timeline"
            value={duration > 0 ? `${duration} months` : "—"}
            testId="success-stat-duration"
          />
          <Stat
            icon={TrendingUp}
            label="Expected payout"
            value={fmtMoney(payout, currency)}
            tone="gold"
            testId="success-stat-payout"
          />
        </div>

        {opp && (
          <div
            className="mt-8 p-5 rounded-2xl bg-zinc-50 border border-zinc-100 text-left"
            data-testid="success-opp-summary"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand">
                  {opp.crop} · {opp.region}
                </div>
                <div className="font-heading font-bold text-ink mt-1">
                  {opp.title}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="inline-flex items-center gap-1 bg-white border border-zinc-200 rounded-full px-2.5 py-1 text-ink-soft">
                  <Bell className="w-3 h-3 text-brand" />
                  Next update:{" "}
                  <strong className="text-ink">within 7 days</strong>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-ink-muted">
              You'll receive verified farm updates, milestone progress, and any
              risk alerts. We never go silent on your capital.
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => nav("/app/portfolio")}
            className="af-btn-primary"
            data-testid="success-track-btn"
          >
            Track your investment <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/app/opportunities"
            className="af-btn-ghost"
            data-testid="success-back-to-market"
          >
            Browse more cycles
          </Link>
        </div>

        <div className="mt-10 text-xs text-ink-muted">
          Most investors diversify across 3–5 cycles. You can always add more
          later.
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, testId }) {
  const toneCls =
    tone === "brand"
      ? "bg-gradient-to-br from-brand to-brand-dark text-white border-0"
      : tone === "gold"
      ? "bg-gradient-to-br from-gold/90 to-amber-500 text-white border-0"
      : "bg-white text-ink";
  return (
    <div className={`af-card p-5 ${toneCls}`} data-testid={testId}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="font-heading font-extrabold text-2xl mt-1.5">{value}</div>
    </div>
  );
}

function Confetti() {
  const colors = ["#0F5132", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"];
  const dots = Array.from({ length: 24 });
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {dots.map((_, i) => {
        const left = (i * 41) % 100;
        const top = (i * 29) % 60;
        const size = 6 + (i % 4) * 2;
        const color = colors[i % colors.length];
        const delay = (i % 8) * 0.1;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              background: color,
              borderRadius: i % 2 === 0 ? "50%" : "2px",
              opacity: 0.85,
              animation: `af-fade-up 1.6s ease-out ${delay}s both`,
            }}
          />
        );
      })}
    </div>
  );
}
