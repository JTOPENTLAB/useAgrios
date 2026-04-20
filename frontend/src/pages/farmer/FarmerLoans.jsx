import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Sparkles, TrendingUp, Clock } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";
import StatCard from "@/components/StatCard";

const BAND_COLOR = {
  A: { ring: "text-emerald-600", bg: "bg-emerald-500/10", label: "Excellent" },
  B: { ring: "text-brand", bg: "bg-brand/10", label: "Good" },
  C: { ring: "text-gold-dark", bg: "bg-gold/10", label: "Fair" },
  D: { ring: "text-rose-600", bg: "bg-rose-500/10", label: "Build credit" },
};

const STATUS_BADGE = {
  pending: "af-badge-pending",
  approved: "af-badge-info",
  disbursed: "af-badge-info",
  partially_repaid: "af-badge-info",
  repaid: "af-badge-verified",
  rejected: "af-chip",
  defaulted: "af-badge-pending",
};

export default function FarmerLoans() {
  const [score, setScore] = useState(null);
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState({ amount: 200000, purpose: "Inputs for next planting cycle", term_months: 6 });
  const [busy, setBusy] = useState(false);
  const [repay, setRepay] = useState({});

  const load = async () => {
    const [s, l] = await Promise.all([api.get("/loans/score"), api.get("/loans/mine")]);
    setScore(s.data);
    setLoans(l.data);
  };
  useEffect(() => { load(); }, []);

  const apply = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/loans/apply", { ...form, amount: Number(form.amount), term_months: Number(form.term_months) });
      toast.success("Application submitted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doRepay = async (id) => {
    const amount = Number(repay[id] || 0);
    if (!amount) return toast.error("Enter an amount");
    try {
      await api.post(`/loans/${id}/repay`, { amount });
      toast.success("Repayment recorded");
      setRepay({ ...repay, [id]: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const band = score ? BAND_COLOR[score.band] : null;

  return (
    <div className="space-y-6" data-testid="farmer-loans-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Financing</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Loans</h1>
        <p className="text-ink-muted mt-1">Get capital for inputs, inventory, and expansion — tied to your on-platform performance.</p>
      </div>

      {score && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 af-stagger">
          <div className="af-card p-6 lg:col-span-1 flex items-center gap-5">
            <div className={`w-24 h-24 rounded-full grid place-items-center ${band.bg}`} data-testid="credit-score-circle">
              <div className="text-center">
                <div className={`font-heading font-extrabold text-3xl ${band.ring}`}>{score.score}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">Score</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Credit band</div>
              <div className="font-heading font-extrabold text-2xl text-ink">{score.band} · {band.label}</div>
              <div className="text-xs text-ink-muted mt-1">Range 300–850. Updated live.</div>
            </div>
          </div>
          <StatCard label="Completed orders" value={score.signals.completed_orders} sub={`₦${(score.signals.gmv || 0).toLocaleString()} GMV`} tone="brand" testId="score-orders" />
          <StatCard label="Active listings" value={score.signals.listings} sub={`${score.signals.farm_size_hectares}ha farm · ${score.signals.previous_repaid_loans} repaid loans`} tone="gold" testId="score-listings" />
        </div>
      )}

      <form onSubmit={apply} className="af-card p-6 grid md:grid-cols-4 gap-4" data-testid="loan-apply-form">
        <div className="md:col-span-4 flex items-center gap-2 text-brand">
          <Banknote className="w-5 h-5" />
          <h3 className="font-heading font-bold">Apply for a new loan</h3>
        </div>
        <label className="block">
          <div className="text-sm font-semibold text-ink-soft mb-1">Amount (₦)</div>
          <input type="number" min={10000} className="af-input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="loan-amount" />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-ink-soft mb-1">Term (months)</div>
          <input type="number" min={1} max={24} className="af-input" required value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} data-testid="loan-term" />
        </label>
        <label className="block md:col-span-2">
          <div className="text-sm font-semibold text-ink-soft mb-1">Purpose</div>
          <input className="af-input" required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} data-testid="loan-purpose" />
        </label>
        <div className="md:col-span-4">
          <button disabled={busy} className="af-btn-primary" data-testid="loan-apply-btn">
            <Sparkles className="w-4 h-4" /> {busy ? "Submitting…" : "Submit application"}
          </button>
        </div>
      </form>

      <div className="af-card overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between">
          <h3 className="font-heading font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand" /> My loans</h3>
          <span className="text-xs text-ink-muted">{loans.length} total</span>
        </div>
        {loans.length === 0 ? (
          <div className="p-10 text-center text-ink-muted">No applications yet — submit one above.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {loans.map((l) => (
              <div key={l.id} className="p-6" data-testid={`loan-row-${l.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">#{l.id.slice(0, 8).toUpperCase()}</div>
                    <h4 className="font-heading font-bold text-xl text-ink mt-0.5">{fmtNGN(l.amount)} · {l.term_months} mo</h4>
                    <div className="text-sm text-ink-soft mt-1">{l.purpose}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-ink-muted">
                      <Clock className="w-3.5 h-3.5" /> {fmtDate(l.created_at)} · Credit score at apply: <b className="text-ink">{l.credit_score}</b>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={STATUS_BADGE[l.status] || "af-chip"}>{l.status.replace(/_/g, " ")}</span>
                    {l.interest_rate_pct && (
                      <div className="text-xs text-ink-muted mt-1">{l.interest_rate_pct}% interest</div>
                    )}
                    {l.outstanding !== undefined && l.status !== "rejected" && (
                      <div className="mt-1 font-heading font-bold text-ink">Outstanding: {fmtNGN(l.outstanding)}</div>
                    )}
                  </div>
                </div>
                {(l.status === "disbursed" || l.status === "partially_repaid") && (
                  <div className="mt-4 flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Repayment amount"
                      className="af-input flex-1"
                      value={repay[l.id] || ""}
                      onChange={(e) => setRepay({ ...repay, [l.id]: e.target.value })}
                      data-testid={`repay-amount-${l.id}`}
                    />
                    <button onClick={() => doRepay(l.id)} className="af-btn-primary" data-testid={`repay-btn-${l.id}`}>Repay</button>
                  </div>
                )}
                {l.schedule && l.schedule.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs font-semibold text-brand cursor-pointer">View repayment schedule</summary>
                    <div className="mt-2 text-xs space-y-1">
                      {l.schedule.map((s, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-ink-muted">#{s.installment} · due {fmtDate(s.due_date)}</span>
                          <span className={s.paid ? "text-brand font-semibold" : "text-ink"}>{fmtNGN(s.amount)} {s.paid ? "✓" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
