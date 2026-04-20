import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, XCircle, Send } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";

const BADGE = {
  pending: "af-badge-pending",
  approved: "af-badge-info",
  disbursed: "af-badge-info",
  partially_repaid: "af-badge-info",
  repaid: "af-badge-verified",
  rejected: "af-chip",
  defaulted: "af-badge-pending",
};

export default function AdminLoans() {
  const [items, setItems] = useState([]);
  const [rate, setRate] = useState({});

  const load = () => api.get("/loans").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const decide = async (id, action) => {
    const interest = Number(rate[id] || 10);
    try {
      await api.post(`/loans/${id}/decision`, { action, interest_rate_pct: interest, notes: "Reviewed" });
      toast.success(`Loan ${action}d`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const disburse = async (id) => {
    try {
      await api.post(`/loans/${id}/disburse`);
      toast.success("Loan disbursed to farmer wallet");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-loans-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">Capital</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Loan pipeline</h1>
        <p className="text-ink-muted mt-1">Review, price, approve, and disburse farmer loans.</p>
      </div>

      {items.length === 0 ? (
        <div className="af-card p-10 text-center">
          <Banknote className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No applications yet</div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((l) => (
            <div key={l.id} className="af-card p-5" data-testid={`admin-loan-${l.id}`}>
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">#{l.id.slice(0, 8).toUpperCase()}</div>
                  <h4 className="font-heading font-bold text-xl mt-1">{l.farmer_name} · {fmtNGN(l.amount)}</h4>
                  <div className="text-sm text-ink-soft mt-1">{l.purpose} · {l.term_months} months</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                    <Field l="Credit score" v={`${l.credit_score} (${l.credit_band})`} />
                    <Field l="Completed orders" v={l.credit_signals?.completed_orders ?? 0} />
                    <Field l="GMV" v={fmtNGN(l.credit_signals?.gmv ?? 0)} />
                    <Field l="Farm size" v={`${l.credit_signals?.farm_size_hectares ?? 0} ha`} />
                    <Field l="Verified" v={l.credit_signals?.verified ? "Yes" : "No"} />
                    <Field l="Repaid loans" v={l.credit_signals?.previous_repaid_loans ?? 0} />
                    <Field l="Defaults" v={l.credit_signals?.defaulted_loans ?? 0} />
                    <Field l="Applied" v={fmtDate(l.created_at)} />
                  </div>
                </div>
                <div className="text-right lg:min-w-[200px]">
                  <span className={BADGE[l.status] || "af-chip"}>{l.status.replace(/_/g, " ")}</span>
                  {l.interest_rate_pct && <div className="text-xs text-ink-muted mt-1">{l.interest_rate_pct}% interest</div>}
                  {l.outstanding !== undefined && <div className="font-heading font-bold mt-1">Out: {fmtNGN(l.outstanding)}</div>}
                </div>
              </div>
              {l.status === "pending" && (
                <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Rate %"
                    value={rate[l.id] ?? 10}
                    onChange={(e) => setRate({ ...rate, [l.id]: e.target.value })}
                    className="af-input max-w-[120px]"
                    data-testid={`rate-${l.id}`}
                  />
                  <button onClick={() => decide(l.id, "approve")} className="af-btn-primary py-2 text-sm" data-testid={`approve-${l.id}`}>
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => decide(l.id, "reject")} className="af-btn-ghost py-2 text-sm text-rose-600" data-testid={`reject-${l.id}`}>
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
              {l.status === "approved" && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <button onClick={() => disburse(l.id)} className="af-btn-accent py-2 text-sm" data-testid={`disburse-${l.id}`}>
                    <Send className="w-4 h-4" /> Disburse to wallet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Field = ({ l, v }) => (
  <div>
    <div className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">{l}</div>
    <div className="font-semibold text-ink">{v}</div>
  </div>
);
