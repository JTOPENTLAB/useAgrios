import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function Login() {
  useDocumentMeta({
    title: "Log in · AgriFlow",
    description: "Log in to AgriFlow — Africa's Agricultural Financial Infrastructure. Marketplace, wallet, escrow, logistics and AI in one platform.",
  });
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.full_name.split(" ")[0]}`);
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const quick = (e, p) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAFA]">
      <div className="hidden lg:block relative">
        <img
          src="https://images.pexels.com/photos/34705724/pexels-photo-34705724.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="Farmer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand/80 via-brand-dark/60 to-ink/80" />
        <div className="relative z-10 h-full flex flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-2" data-testid="login-brand">
            <div className="w-10 h-10 rounded-xl bg-white grid place-items-center text-brand font-heading font-extrabold">A</div>
            <span className="font-heading font-extrabold text-2xl">AgriFlow</span>
          </Link>
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-gold">From Farm to Money</div>
            <h2 className="font-heading font-extrabold text-4xl mt-3 leading-tight">
              Africa's agricultural financial infrastructure.
            </h2>
            <p className="text-white/80 mt-4 max-w-md">
              Listings, escrow, wallet, logistics, AI — one trusted platform.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="font-heading font-extrabold text-3xl text-ink">Welcome back</h1>
            <p className="text-ink-muted mt-2">Log in to your AgriFlow account.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Email</label>
              <input
                className="af-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-soft mb-1 block">Password</label>
              <input
                className="af-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
              />
            </div>
            <button disabled={busy} className="af-btn-primary w-full" data-testid="login-submit">
              {busy ? "Signing in…" : "Log in"}
            </button>
          </form>

          <div className="mt-6 af-card p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">Demo accounts</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Farmer", "farmer@agriflow.ng", "Farmer@123"],
                ["Buyer", "buyer@agriflow.ng", "Buyer@123"],
                ["Logistics", "logistics@agriflow.ng", "Logistics@123"],
                ["Admin", "admin@agriflow.ng", "Admin@12345"],
              ].map(([role, em, pw]) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => quick(em, pw)}
                  className="text-left rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-brand hover:bg-brand/5 transition"
                  data-testid={`demo-${role.toLowerCase()}`}
                >
                  <div className="font-semibold text-ink">{role}</div>
                  <div className="text-xs text-ink-muted truncate">{em}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 text-sm text-ink-muted">
            New to AgriFlow?{" "}
            <Link to="/signup" className="text-brand font-semibold" data-testid="link-to-signup">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
