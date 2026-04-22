import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PartyPopper, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingSuccess() {
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    api.post("/onboarding/complete").catch(() => {});
  }, []);

  const primaryPath = user?.role === "investor" ? "/app/first-investment" : "/app";
  const primaryLabel = user?.role === "investor" ? "Start your first investment" : "Go to dashboard";

  return (
    <div
      className="min-h-[70vh] grid place-items-center text-center relative overflow-hidden"
      data-testid="onboarding-success"
    >
      {/* Celebration confetti dots */}
      <Confetti />
      <div className="relative max-w-xl">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-brand to-brand-dark grid place-items-center text-white shadow-lift animate-[pulse_1.6s_ease-out_infinite]">
          <PartyPopper className="w-9 h-9" />
        </div>
        <h1
          className="font-heading font-extrabold text-4xl sm:text-5xl text-ink mt-6 leading-tight"
          data-testid="success-title"
        >
          You're all set <span className="inline-block">🎉</span>
        </h1>
        <p className="text-ink-muted mt-3 text-lg">
          Your account is ready. Start exploring verified opportunities,
          marketplaces, and cycles — all in one place.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => nav(primaryPath)}
            className="af-btn-primary"
            data-testid="success-dashboard-btn"
          >
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/app/opportunities"
            className="af-btn-ghost"
            data-testid="success-explore-btn"
          >
            Browse opportunities
          </Link>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-3 text-left">
          <div className="af-card p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand mt-0.5" />
            <div>
              <div className="font-heading font-bold text-ink text-sm">
                Protected by default
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                Escrow on every transaction. Immutable ledger for every kobo.
              </div>
            </div>
          </div>
          <div className="af-card p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-gold-ink mt-0.5" />
            <div>
              <div className="font-heading font-bold text-ink text-sm">
                You'll get tailored picks
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                Your preferences help us surface the right cycles first.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  // 18 small dots positioned around the hero — pure CSS animation.
  const colors = ["#0F5132", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"];
  const dots = Array.from({ length: 18 });
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      data-testid="success-confetti"
    >
      {dots.map((_, i) => {
        const left = (i * 53) % 100;
        const top = (i * 37) % 80;
        const size = 6 + (i % 4) * 2;
        const color = colors[i % colors.length];
        const delay = (i % 6) * 0.15;
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
              animation: `fade-up 1.4s ease-out ${delay}s both`,
            }}
          />
        );
      })}
    </div>
  );
}
