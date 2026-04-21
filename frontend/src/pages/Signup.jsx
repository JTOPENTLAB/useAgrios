import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { id: "farmer", title: "Farmer", desc: "List produce, get paid, access finance." },
  { id: "buyer", title: "Buyer", desc: "Source verified supply with escrow protection." },
  { id: "logistics", title: "Logistics partner", desc: "Accept jobs, run deliveries, earn." },
];

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState("farmer");
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    business_name: "",
    location: "",
    referral_code: "",
    farm_size_hectares: "",
    country: "NG",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/countries").then((r) => setCountries(r.data)); }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, role };
      if (payload.farm_size_hectares) payload.farm_size_hectares = Number(payload.farm_size_hectares);
      else delete payload.farm_size_hectares;
      if (!payload.referral_code) delete payload.referral_code;
      await signup(payload);
      toast.success("Welcome to AgriFlow!");
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2 mb-8" data-testid="signup-brand">
          <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">A</div>
          <span className="font-heading font-extrabold text-xl text-ink">AgriFlow</span>
        </Link>

        <div className="af-card p-8 sm:p-10">
          <h1 className="font-heading font-extrabold text-3xl text-ink">Create your account</h1>
          <p className="text-ink-muted mt-2">Pick how you plan to use AgriFlow.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`text-left rounded-2xl p-4 border-2 transition ${
                  role === r.id ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
                data-testid={`role-${r.id}`}
              >
                <div className="font-heading font-bold text-ink">{r.title}</div>
                <div className="text-xs text-ink-muted mt-1 leading-relaxed">{r.desc}</div>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8" data-testid="signup-form">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Country</label>
              <div className="flex flex-wrap gap-2" data-testid="country-picker">
                {countries.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => setForm((f) => ({ ...f, country: c.code }))}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
                      form.country === c.code ? "bg-brand text-white border-brand" : "bg-white text-ink-soft border-zinc-200 hover:border-brand"
                    }`}
                    data-testid={`country-${c.code}`}
                  >
                    <span className="mr-1.5">{c.flag}</span> {c.name} · {c.currency}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Full name</label>
              <input className="af-input" required value={form.full_name} onChange={upd("full_name")} data-testid="signup-name" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Email</label>
              <input type="email" className="af-input" required value={form.email} onChange={upd("email")} data-testid="signup-email" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Password</label>
              <input type="password" className="af-input" required minLength={6} value={form.password} onChange={upd("password")} data-testid="signup-password" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Phone</label>
              <input className="af-input" placeholder="+234..." value={form.phone} onChange={upd("phone")} data-testid="signup-phone" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Location / State</label>
              <input className="af-input" value={form.location} onChange={upd("location")} data-testid="signup-location" />
            </div>
            {role === "buyer" && (
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-ink-soft mb-1 block">Business name</label>
                <input className="af-input" value={form.business_name} onChange={upd("business_name")} data-testid="signup-business" />
              </div>
            )}
            {role === "farmer" && (
              <div>
                <label className="text-sm font-semibold text-ink-soft mb-1 block">Farm size (hectares)</label>
                <input type="number" min="0" step="0.1" className="af-input" value={form.farm_size_hectares} onChange={upd("farm_size_hectares")} placeholder="e.g. 5" data-testid="signup-farm-size" />
              </div>
            )}
            <div className={role === "farmer" ? "" : "sm:col-span-2"}>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Referral code <span className="text-ink-muted font-normal">(optional)</span></label>
              <input className="af-input" placeholder="AF-XXXXXX" value={form.referral_code} onChange={(e) => upd("referral_code")({ target: { value: e.target.value.toUpperCase() } })} data-testid="signup-referral" />
            </div>
            <div className="sm:col-span-2 pt-2">
              <button disabled={busy} className="af-btn-primary w-full" data-testid="signup-submit">
                {busy ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-sm text-ink-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-brand font-semibold" data-testid="link-to-login">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
