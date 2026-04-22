import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Sprout,
  ShoppingBag,
  TrendingUp,
  Truck,
  ShieldCheck,
  Clock,
  Lock,
  ArrowRight,
  Linkedin,
  Info,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const ROLES = [
  {
    id: "investor",
    title: "Investor",
    icon: TrendingUp,
    desc: "Allocate capital into verified agricultural cycles.",
    subtext: "Allocate capital into verified agricultural opportunities.",
    context: [
      { icon: TrendingUp, label: "Avg allocation", value: "₦50k – ₦500k" },
      { icon: Clock, label: "Cycle duration", value: "3 – 6 months" },
      { icon: ShieldCheck, label: "Every cycle", value: "Verified & risk-banded" },
    ],
  },
  {
    id: "farmer",
    title: "Farmer",
    icon: Sprout,
    desc: "Access funding. Sell produce. Grow your farm.",
    subtext: "Access funding and grow your farm.",
    context: [
      { icon: TrendingUp, label: "Funding access", value: "Fast — days, not months" },
      { icon: ShieldCheck, label: "Support", value: "Structured + supervised" },
      { icon: Clock, label: "Onboarding", value: "Simple, under 10 minutes" },
    ],
  },
  {
    id: "buyer",
    title: "Buyer",
    icon: ShoppingBag,
    desc: "Source verified supply with escrow protection.",
    subtext: "Source verified agricultural supply.",
    context: [
      { icon: ShieldCheck, label: "Supply", value: "Verified, KYC-checked farmers" },
      { icon: Lock, label: "Risk", value: "Escrow until delivery confirmed" },
      { icon: Clock, label: "Partners", value: "Reliable, repeat-tested" },
    ],
  },
  {
    id: "logistics",
    title: "Logistics",
    icon: Truck,
    desc: "Accept jobs. Run deliveries. Earn.",
    subtext: "Coordinate deliveries. Earn per job.",
    context: [
      { icon: Clock, label: "Payouts", value: "Per completed delivery" },
      { icon: TrendingUp, label: "Jobs", value: "Posted daily across routes" },
      { icon: ShieldCheck, label: "Coverage", value: "Nigeria · Ghana · Kenya · CI" },
    ],
  },
];

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function startGoogleAuth({ role, next, country }) {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (next) params.set("next", next);
  if (country) params.set("country", country);
  const qs = params.toString();
  const redirectUrl =
    window.location.origin + "/auth/callback" + (qs ? `?${qs}` : "");
  window.location.href =
    "https://auth.emergentagent.com/?redirect=" +
    encodeURIComponent(redirectUrl);
}

export default function Signup() {
  useDocumentMeta({
    title: "Get started — AGRIOS",
    description:
      "Join AGRIOS in under 60 seconds. Continue with Google or email. Secure, encrypted, and built on escrow-first infrastructure.",
  });

  const [sp] = useSearchParams();
  const preRole = sp.get("role");
  const preRef = sp.get("ref") || (typeof window !== "undefined" ? localStorage.getItem("agrios_referral") : null);
  const next = sp.get("next");
  const { signup } = useAuth();
  const nav = useNavigate();

  const [role, setRole] = useState(
    ROLES.find((r) => r.id === preRole)?.id || "investor",
  );
  const [countries, setCountries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    country: "NG",
    referral_code: preRef ? preRef.toUpperCase() : "",
  });

  useEffect(() => {
    api.get("/countries").then((r) => setCountries(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (preRole && ROLES.find((r) => r.id === preRole)) setRole(preRole);
  }, [preRole]);

  const roleCfg = useMemo(
    () => ROLES.find((r) => r.id === role) || ROLES[0],
    [role],
  );

  const upd = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, role };
      if (!payload.referral_code) delete payload.referral_code;
      await signup(payload);
      toast.success("Welcome to AGRIOS!");
      nav(next || "/onboarding/profile", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () =>
    startGoogleAuth({ role, next: next || "/onboarding/profile", country: form.country });

  const RoleIcon = roleCfg.icon;

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="signup-page">
      {/* Compact top-bar */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="signup-brand">
            <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-lg text-ink">
              AGRIOS
            </span>
          </Link>
          <div className="text-sm text-ink-muted">
            Have an account?{" "}
            <Link
              to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="text-brand font-semibold"
              data-testid="link-to-login"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 grid lg:grid-cols-5 gap-10">
        {/* LEFT — form */}
        <section className="lg:col-span-3">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Create your account
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2 leading-tight">
            Get started with AGRIOS
          </h1>
          <p className="text-ink-muted mt-2" data-testid="signup-subtext">
            {roleCfg.subtext}
          </p>
          <div className="text-xs text-ink-muted mt-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Takes less than 60 seconds.
          </div>

          {/* Role switcher */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6"
            data-testid="role-switcher"
          >
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`text-left rounded-2xl p-3 border-2 transition ${
                    active
                      ? "border-brand bg-brand/5"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  }`}
                  data-testid={`role-${r.id}`}
                >
                  <Icon
                    className={`w-4 h-4 mb-1.5 ${
                      active ? "text-brand" : "text-ink-muted"
                    }`}
                  />
                  <div className="font-heading font-bold text-ink text-sm">
                    {r.title}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5 leading-snug line-clamp-2">
                    {r.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Google OAuth — primary */}
          <button
            type="button"
            onClick={onGoogle}
            className="w-full mt-6 inline-flex items-center justify-center gap-3 rounded-full px-5 py-3 font-semibold border border-zinc-200 bg-white hover:border-brand/40 hover:bg-brand/5 transition shadow-sm"
            data-testid="google-oauth-btn"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5" data-testid="auth-divider">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-xs font-bold uppercase text-ink-muted">
              or continue with email
            </span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">
                Full name
              </label>
              <input
                className="af-input"
                required
                value={form.full_name}
                onChange={upd("full_name")}
                data-testid="signup-name"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-ink-soft mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  className="af-input"
                  required
                  value={form.email}
                  onChange={upd("email")}
                  data-testid="signup-email"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-ink-soft mb-1 block">
                  Password
                </label>
                <input
                  type="password"
                  className="af-input"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={upd("password")}
                  data-testid="signup-password"
                />
              </div>
            </div>
            {countries.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-ink-soft mb-1 block">
                  Country
                </label>
                <div className="flex flex-wrap gap-2" data-testid="country-picker">
                  {countries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, country: c.code }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                        form.country === c.code
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
                      }`}
                      data-testid={`country-${c.code}`}
                    >
                      <span className="mr-1">{c.flag}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">
                Referral code{" "}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                className="af-input"
                placeholder="AF-XXXXXX"
                value={form.referral_code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    referral_code: e.target.value.toUpperCase(),
                  }))
                }
                data-testid="signup-referral"
              />
            </div>
            <button
              disabled={busy}
              className="af-btn-primary w-full disabled:opacity-60"
              data-testid="signup-submit"
            >
              {busy ? "Creating…" : (
                <>
                  Continue as {roleCfg.title} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="text-xs text-ink-muted flex items-center gap-1.5 justify-center">
              <Lock className="w-3 h-3" />
              Your data is secure and encrypted.
            </div>
          </form>

          {/* LinkedIn — placeholder with intent */}
          <LinkedInButton />
        </section>

        {/* RIGHT — contextual panel */}
        <aside className="lg:col-span-2 lg:sticky lg:top-8 self-start">
          <div
            className="af-card p-6 bg-gradient-to-br from-brand to-brand-dark text-white relative overflow-hidden"
            data-testid="role-context-panel"
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-gold/20" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-white/10 rounded-full px-2.5 py-1">
                <RoleIcon className="w-3 h-3" />
                For {roleCfg.title}s
              </div>
              <h2 className="font-heading font-extrabold text-2xl mt-4 leading-tight">
                What to expect on AGRIOS
              </h2>
              <p className="text-white/80 text-sm mt-2 leading-relaxed">
                {roleCfg.subtext}
              </p>
              <ul className="mt-6 space-y-3">
                {roleCfg.context.map((c, i) => {
                  const CIcon = c.icon;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center flex-shrink-0">
                        <CIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-white/60">
                          {c.label}
                        </div>
                        <div className="font-heading font-bold text-sm">
                          {c.value}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 pt-5 border-t border-white/15 text-xs text-white/70 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                Escrow-protected on every cycle. Read our{" "}
                <Link to="/trust" className="underline font-semibold">
                  Trust Center
                </Link>
                .
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function LinkedInButton() {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="mt-4 relative" data-testid="linkedin-wrap">
      <button
        type="button"
        onClick={() => {
          setShowTip(true);
          setTimeout(() => setShowTip(false), 4500);
        }}
        className="w-full inline-flex items-center justify-center gap-3 rounded-full px-5 py-3 font-semibold border border-zinc-200 bg-white text-ink-muted hover:border-zinc-300 transition"
        data-testid="linkedin-oauth-btn"
      >
        <Linkedin className="w-4 h-4 text-[#0A66C2]" />
        Continue with LinkedIn{" "}
        <span className="text-[10px] font-bold uppercase bg-zinc-100 rounded-full px-2 py-0.5">
          Investors
        </span>
      </button>
      {showTip && (
        <div
          className="absolute z-10 left-0 right-0 mt-2 p-3 rounded-xl bg-ink text-white text-xs flex items-start gap-2 shadow-lift"
          data-testid="linkedin-tooltip"
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gold" />
          <span>
            LinkedIn sign-in is enabled for verified investor accounts. Full
            rollout coming soon. Use Google or email to get started now.
          </span>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.1l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3 0 5.7 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.4-17.7 10.1z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c4.4-4.1 7-10 7-16.8 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
