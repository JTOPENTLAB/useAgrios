import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet as WalletIcon, ArrowDown, ArrowUp, Lock } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";
import StatCard from "@/components/StatCard";

export default function Wallet() {
  const [data, setData] = useState({ wallet: null, entries: [] });
  const [topup, setTopup] = useState(10000);
  const [payout, setPayout] = useState({ amount: 0, bank_account: "" });

  const load = () => api.get("/wallet").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const fund = async () => {
    try {
      await api.post("/wallet/fund", { amount: Number(topup) });
      toast.success(`Added ${fmtNGN(topup)}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const requestPayout = async () => {
    if (!payout.bank_account) return toast.error("Enter bank account");
    try {
      await api.post("/wallet/payout", payout);
      toast.success("Payout requested");
      setPayout({ amount: 0, bank_account: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const w = data.wallet || { available: 0, escrow_held: 0, pending: 0 };

  return (
    <div className="space-y-6" data-testid="wallet-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Money</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Wallet</h1>
        <p className="text-ink-muted mt-1">Fund, hold, and move money across AGRIOS — with full ledger integrity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 af-stagger">
        <StatCard label="Available" value={fmtNGN(w.available)} sub="Ready to spend / payout" tone="brand" testId="wallet-available" />
        <StatCard label="In escrow" value={fmtNGN(w.escrow_held)} sub="Locked against orders" tone="gold" testId="wallet-escrow" />
        <StatCard label="Processing payouts" value={fmtNGN(w.pending)} sub="Settling to bank" tone="blue" testId="wallet-pending" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="af-card p-6">
          <h3 className="font-heading font-bold mb-4 flex items-center gap-2"><ArrowDown className="w-4 h-4 text-brand" /> Top up wallet</h3>
          <p className="text-sm text-ink-muted mb-4">Simulated top-up for MVP. In production this integrates with Paystack / Flutterwave.</p>
          <div className="flex gap-3">
            <input type="number" min={1} className="af-input flex-1" value={topup} onChange={(e) => setTopup(e.target.value)} data-testid="topup-input" />
            <button onClick={fund} className="af-btn-primary" data-testid="topup-btn">Fund</button>
          </div>
        </div>
        <div className="af-card p-6">
          <h3 className="font-heading font-bold mb-4 flex items-center gap-2"><ArrowUp className="w-4 h-4 text-gold-dark" /> Request payout</h3>
          <div className="space-y-3">
            <input className="af-input" placeholder="Bank account number" value={payout.bank_account} onChange={(e) => setPayout({ ...payout, bank_account: e.target.value })} data-testid="payout-bank" />
            <input type="number" min={1} max={w.available} className="af-input" placeholder="Amount" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: Number(e.target.value) })} data-testid="payout-amount" />
            <button onClick={requestPayout} className="af-btn-secondary w-full" data-testid="payout-btn">Request payout</button>
          </div>
        </div>
      </div>

      <div className="af-card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="font-heading font-bold flex items-center gap-2"><WalletIcon className="w-4 h-4 text-brand" /> Ledger</h3>
        </div>
        {data.entries.length === 0 ? (
          <div className="p-10 text-center text-ink-muted">No transactions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
              <tr>
                <th className="text-left p-4">When</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Note</th>
                <th className="text-right p-4">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.entries.map((e) => (
                <tr key={e.id} data-testid={`ledger-${e.id}`}>
                  <td className="p-4 text-ink-muted">{fmtDate(e.created_at)}</td>
                  <td className="p-4"><span className="af-chip capitalize">{e.kind.replace(/_/g, " ")}</span></td>
                  <td className="p-4">{e.note}</td>
                  <td className={`p-4 text-right font-heading font-bold ${e.direction === "credit" ? "text-brand" : "text-rose-600"}`}>
                    {e.direction === "credit" ? "+" : "-"}{fmtNGN(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
