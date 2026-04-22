import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const ONBOARDING_STEPS = [
  { id: 1, path: "/onboarding/profile", label: "Profile" },
  { id: 2, path: "/onboarding/kyc", label: "Verification" },
  { id: 3, path: "/onboarding/wallet", label: "Wallet" },
  { id: 4, path: "/onboarding/invest", label: "First move" },
  { id: 5, path: "/onboarding/success", label: "Done" },
];

export default function OnboardingShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!user) {
      nav("/login", { replace: true });
      return;
    }
    api
      .get("/onboarding/state")
      .then((r) => setState(r.data))
      .catch(() => setState({ step: 1, total_steps: 5, percent: 20 }));
  }, [user, nav, location.pathname]);

  const currentStep =
    ONBOARDING_STEPS.find((s) => s.path === location.pathname)?.id || 1;
  const percent = Math.max(
    Math.round((currentStep / 5) * 100),
    state?.percent || 0,
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="onboarding-shell">
      <header className="border-b border-zinc-100 bg-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-lg text-ink">
              AGRIOS
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" /> Secure onboarding
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              nav("/", { replace: true });
            }}
            className="text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1"
            data-testid="onboarding-logout"
          >
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>

        {/* Progress */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2">
            <span className="text-ink-muted">
              Step {currentStep} of {ONBOARDING_STEPS.length}
            </span>
            <span className="text-brand" data-testid="onboarding-percent">
              {percent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand to-emerald-500 transition-all"
              style={{ width: `${percent}%` }}
              data-testid="onboarding-progress-bar"
            />
          </div>
          <div
            className="mt-2 flex items-center gap-1 overflow-x-auto"
            data-testid="onboarding-steps"
          >
            {ONBOARDING_STEPS.map((s) => {
              const done = s.id < currentStep;
              const cur = s.id === currentStep;
              return (
                <div
                  key={s.id}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${
                    cur
                      ? "bg-brand text-white"
                      : done
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-ink-muted"
                  }`}
                  data-testid={`step-chip-${s.id}`}
                >
                  {done ? <CheckCircle2 className="w-3 h-3" /> : <span>{s.id}</span>}
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Outlet context={{ onboardingState: state, refreshState: () =>
          api.get("/onboarding/state").then((r) => setState(r.data)).catch(() => {})
        }} />
      </main>
    </div>
  );
}
