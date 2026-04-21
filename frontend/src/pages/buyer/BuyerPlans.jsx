import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Crown, Building2, Leaf } from "lucide-react";
import api, { fmtNGN } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ICONS = { basic: Leaf, professional: Sparkles, enterprise: Building2 };
const ACCENT = {
  basic: { border: "border-zinc-200", btn: "af-btn-ghost border border-zinc-200", ring: "bg-zinc-100 text-ink-soft" },
  professional: { border: "border-brand ring-4 ring-brand/10", btn: "af-btn-primary", ring: "bg-brand/10 text-brand" },
  enterprise: { border: "border-gold", btn: "af-btn-accent", ring: "bg-gold/10 text-gold-dark" },
};

export default function BuyerPlans() {
  const { user, setUser } = useAuth();
  const [data, setData] = useState({ tier: "basic", plans: [] });
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/subscriptions/me").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const subscribe = async (tier) => {
    setBusy(tier);
    try {
      const { data: res } = await api.post("/subscriptions/subscribe", { tier });
      toast.success(
        tier === "basic" ? "Downgraded to Basic" : `${tier.charAt(0).toUpperCase() + tier.slice(1)} plan activated`
      );
      // Refresh cached user
      const { data: me } = await api.get("/auth/me");
      setUser(me);
      localStorage.setItem("agriflow_user", JSON.stringify(me));
      setData({ ...data, tier: res.tier, expires_at: res.expires_at });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8" data-testid="plans-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Upgrade</div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink">Buyer plans</h1>
        <p className="text-ink-muted mt-2 max-w-2xl">
          Move more volume, source faster, and close deals with confidence. Cancel anytime.
        </p>
        {data.expires_at && (
          <div className="mt-3 af-badge-verified">
            <Crown className="w-3 h-3" /> {data.tier.charAt(0).toUpperCase() + data.tier.slice(1)} active until {new Date(data.expires_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 af-stagger">
        {data.plans.map((p) => {
          const Icon = ICONS[p.tier] || Leaf;
          const style = ACCENT[p.tier];
          const isCurrent = data.tier === p.tier;
          return (
            <div
              key={p.tier}
              className={`af-card p-6 flex flex-col ${style.border} ${p.popular ? "ring-4 ring-brand/10 border-brand" : ""} relative`}
              data-testid={`plan-${p.tier}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-6 af-badge-verified bg-brand text-white">Most popular</span>
              )}
              <div className={`w-11 h-11 rounded-xl grid place-items-center ${style.ring}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-ink mt-4">{p.name}</h3>
              <p className="text-sm text-ink-muted mt-1">{p.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                <div className="font-heading font-extrabold text-4xl text-ink">
                  {p.price_ngn === 0 ? "Free" : fmtNGN(p.price_ngn)}
                </div>
                {p.price_ngn > 0 && <div className="text-ink-muted text-sm mb-1">/ month</div>}
              </div>
              <ul className="mt-6 space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-ink-soft">
                    <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p.tier)}
                disabled={busy || isCurrent}
                className={`mt-6 ${isCurrent ? "af-btn-ghost border border-zinc-200" : style.btn} disabled:opacity-60`}
                data-testid={`subscribe-${p.tier}`}
              >
                {isCurrent ? "Current plan" : busy === p.tier ? "Processing…" : p.price_ngn === 0 ? "Downgrade" : `Subscribe — ${fmtNGN(p.price_ngn)}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="af-card p-6 bg-gradient-to-br from-brand/5 to-white border-l-4 border-l-brand">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <Sparkles className="w-6 h-6 text-brand flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-ink">How billing works today (MVP)</h3>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">
              Subscription fees are drawn directly from your AgriFlow wallet for 30 days of access. Once
              Paystack / Flutterwave is wired, you'll be able to auto-renew on card. Top up your wallet on
              the Wallet page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
