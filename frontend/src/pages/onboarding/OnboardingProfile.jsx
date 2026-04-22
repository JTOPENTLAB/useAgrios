import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Sprout, ShoppingBag, TrendingUp, Truck } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const INVESTOR_GOALS = [
  { id: "passive_income", label: "Passive income", desc: "Earn predictable returns" },
  { id: "growth", label: "Growth", desc: "Compound capital over cycles" },
  { id: "diversification", label: "Diversification", desc: "Exposure to real agriculture" },
];
const RISK_PREFS = [
  { id: "low", label: "Low", desc: "Risk A · shorter cycles" },
  { id: "medium", label: "Medium", desc: "Risk B · balanced" },
  { id: "high", label: "High", desc: "Risk C · higher upside" },
];
const FARM_TYPES = ["Grains", "Tubers", "Vegetables", "Livestock", "Tree crops", "Mixed"];
const FUNDING_RANGES = [
  { id: "0-500k", label: "Up to ₦500k" },
  { id: "500k-5M", label: "₦500k – ₦5M" },
  { id: "5M+", label: "Over ₦5M" },
];
const COMMODITIES = ["Tomatoes", "Cassava", "Yam", "Rice", "Maize", "Plantain", "Mixed"];
const VOLUME_RANGES = [
  { id: "small", label: "Small (under 1 ton / week)" },
  { id: "medium", label: "Medium (1 – 10 tons / week)" },
  { id: "large", label: "Large (10+ tons / week)" },
];

export default function OnboardingProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { refreshState } = useOutletContext() || {};
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    investment_goal: "",
    risk_preference: "",
    farm_type: "",
    location: "",
    funding_need_range: "",
    commodity_interest: "",
    volume_range: "",
  });

  useEffect(() => {
    api.get("/onboarding/state").then((r) => {
      const p = r.data.profile || {};
      setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)) }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v && String(v).trim() !== ""),
      );
      await api.patch("/onboarding/profile", payload);
      await api.post("/onboarding/advance");
      refreshState && refreshState();
      toast.success("Profile saved");
      nav("/onboarding/kyc");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const role = user?.role || "investor";
  const canContinue = (() => {
    if (role === "investor") return !!form.investment_goal;
    if (role === "farmer") return !!form.farm_type;
    if (role === "buyer") return !!form.commodity_interest;
    return true;
  })();

  const RoleIcon =
    role === "investor" ? TrendingUp : role === "farmer" ? Sprout : role === "buyer" ? ShoppingBag : Truck;

  return (
    <div className="space-y-6" data-testid="onboarding-profile">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
          <RoleIcon className="w-3.5 h-3.5" />
          Step 1 · Profile
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
          Tell us who you are.
        </h1>
        <p className="text-ink-muted mt-2">
          We use this to personalise your experience — one decision per screen, no long forms.
        </p>
      </div>

      <div className="af-card p-6 sm:p-7 space-y-6">
        {role === "investor" && (
          <>
            <Chooser
              title="What's your primary goal?"
              required
              options={INVESTOR_GOALS}
              value={form.investment_goal}
              onChange={(v) => setForm((f) => ({ ...f, investment_goal: v }))}
              testPrefix="goal"
            />
            <Chooser
              title="Risk preference"
              optional
              options={RISK_PREFS}
              value={form.risk_preference}
              onChange={(v) => setForm((f) => ({ ...f, risk_preference: v }))}
              testPrefix="risk"
            />
          </>
        )}

        {role === "farmer" && (
          <>
            <Chooser
              title="What do you farm?"
              required
              options={FARM_TYPES.map((t) => ({ id: t, label: t }))}
              value={form.farm_type}
              onChange={(v) => setForm((f) => ({ ...f, farm_type: v }))}
              testPrefix="farmtype"
            />
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">
                Location / state <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                className="af-input"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Oyo"
                data-testid="input-location"
              />
            </div>
            <Chooser
              title="Funding need range"
              optional
              options={FUNDING_RANGES}
              value={form.funding_need_range}
              onChange={(v) => setForm((f) => ({ ...f, funding_need_range: v }))}
              testPrefix="funding"
            />
          </>
        )}

        {role === "buyer" && (
          <>
            <Chooser
              title="Which commodities do you source?"
              required
              options={COMMODITIES.map((t) => ({ id: t, label: t }))}
              value={form.commodity_interest}
              onChange={(v) => setForm((f) => ({ ...f, commodity_interest: v }))}
              testPrefix="commodity"
            />
            <Chooser
              title="Typical volume"
              optional
              options={VOLUME_RANGES}
              value={form.volume_range}
              onChange={(v) => setForm((f) => ({ ...f, volume_range: v }))}
              testPrefix="volume"
            />
          </>
        )}

        {role === "logistics" && (
          <div className="text-sm text-ink-muted">
            Nothing to configure yet — we'll review your partner application from the next screen.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-ink-muted">
          Saved instantly. You can edit any answer later from your profile.
        </div>
        <button
          onClick={save}
          disabled={busy || !canContinue}
          className="af-btn-primary disabled:opacity-50"
          data-testid="profile-continue-btn"
        >
          {busy ? "Saving…" : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
        </button>
      </div>
    </div>
  );
}

function Chooser({ title, options, value, onChange, testPrefix, required, optional }) {
  return (
    <div>
      <div className="text-sm font-semibold text-ink-soft mb-2 flex items-center gap-2">
        {title}
        {required && <span className="text-[10px] uppercase font-bold text-brand">Required</span>}
        {optional && <span className="text-[10px] uppercase font-bold text-ink-muted">Optional</span>}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`text-left rounded-xl p-3 border-2 transition text-sm ${
                active
                  ? "border-brand bg-brand/5"
                  : "border-zinc-200 hover:border-zinc-300 bg-white"
              }`}
              data-testid={`${testPrefix}-${o.id}`}
            >
              <div className="font-heading font-bold text-ink">{o.label}</div>
              {o.desc && (
                <div className="text-xs text-ink-muted mt-0.5">{o.desc}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
