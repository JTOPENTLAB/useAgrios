import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Wallet as WalletIcon,
  ArrowDown,
  ArrowUp,
  Lock,
  Shield,
  Zap,
  TrendingUp,
  Banknote,
  CreditCard,
  Building2,
} from "lucide-react";
import api, { fmtMoney, fmtDate } from "@/lib/api";
import TrustStrip from "@/components/TrustStrip";
import { useAuth } from "@/context/AuthContext";

export default function Wallet() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [data, setData] = useState({ wallet: null, entries: [] });
  const [view, setView] = useState("idle"); // idle | deposit | withdraw
  const [topup, setTopup] = useState(10000);
  const [payout, setPayout] = useState({ amount: 0, bank_account: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/wallet").then((r) => setData(r.data));
  useEffect(() => {
    load();
  }, []);

  const fund = async () => {
    if (!Number(topup) || Number(topup) <= 0) return toast.error("Enter amount");
    setBusy(true);
    try {
      await api.post("/wallet/fund", { amount: Number(topup) });
      toast.success(`Added ${fmtMoney(topup, currency)} to wallet`);
      setView("idle");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const requestPayout = async () => {
    if (!payout.bank_account) return toast.error("Enter bank account number");
    if (!payout.amount || payout.amount <= 0) return toast.error("Enter amount");
    setBusy(true);
    try {
      await api.post("/wallet/payout", payout);
      toast.success("Payout requested — funds land within 24h");
      setPayout({ amount: 0, bank_account: "" });
      setView("idle");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const w = data.wallet || { available: 0, escrow_held: 0, pending: 0 };
  const totalCapacity = (w.available || 0) + (w.escrow_held || 0) + (w.pending || 0);

  return (
    <div className="space-y-7" data-testid="wallet-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Money</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Wallet</h1>
        <p className="text-ink-muted mt-1">
          Bank-grade ledger. Escrow-protected flow. Built for African agricultural trade.
        </p>
      </div>

      {/* ========== Premium Balance Card ========== */}
      <section
        className="rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark text-white p-6 sm:p-8 shadow-lift relative overflow-hidden"
        data-testid="wallet-balance-card"
      >
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-gold/10" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> AGRIOS Wallet
            </div>
            <span className="af-chip bg-white/10 text-white border-white/20 text-[10px]">
              {currency}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Available balance
            </div>
            <div
              className="font-heading font-extrabold text-5xl sm:text-6xl leading-none mt-2 tracking-tight"
              data-testid="wallet-balance-main"
            >
              {fmtMoney(w.available, currency)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={() => setView("deposit")}
              className="inline-flex items-center gap-2 bg-white text-brand font-bold rounded-full px-5 py-3 hover:bg-zinc-50 transition"
              data-testid="deposit-btn"
            >
              <ArrowDown className="w-4 h-4" /> Deposit
            </button>
            <button
              onClick={() => setView("withdraw")}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-full px-5 py-3 transition"
              data-testid="withdraw-btn"
            >
              <ArrowUp className="w-4 h-4" /> Withdraw
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-7 pt-6 border-t border-white/10">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">
                In escrow
              </div>
              <div
                className="font-heading font-extrabold text-xl mt-1"
                data-testid="wallet-escrow-amt"
              >
                {fmtMoney(w.escrow_held, currency)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">
                Pending payout
              </div>
              <div
                className="font-heading font-extrabold text-xl mt-1"
                data-testid="wallet-pending-amt"
              >
                {fmtMoney(w.pending, currency)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">
                Total capacity
              </div>
              <div className="font-heading font-extrabold text-xl mt-1">
                {fmtMoney(totalCapacity, currency)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Trust rail ========== */}
      <div className="grid sm:grid-cols-3 gap-4" data-testid="wallet-trust-rail">
        <div className="af-card p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-bold text-ink text-sm">Protected transactions</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Every payment is held in escrow until delivery is confirmed.
            </div>
          </div>
        </div>
        <div className="af-card p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-bold text-ink text-sm">Fast payouts</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Funds land in your bank within 24 hours of request.
            </div>
          </div>
        </div>
        <div className="af-card p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 grid place-items-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-bold text-ink text-sm">Immutable ledger</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Full auditability — every naira, cedi, shilling and franc accounted for.
            </div>
          </div>
        </div>
      </div>

      {/* ========== Deposit / Withdraw drawers ========== */}
      {view === "deposit" && (
        <div className="af-card p-6" data-testid="deposit-drawer">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <ArrowDown className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-ink">Deposit funds</h3>
              <div className="text-xs text-ink-muted">
                Simulated top-up for MVP. Live gateway rails (Paystack / Flutterwave) coming soon.
              </div>
            </div>
            <button
              onClick={() => setView("idle")}
              className="text-sm text-ink-muted hover:text-ink"
              data-testid="cancel-deposit"
            >
              Cancel
            </button>
          </div>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">
                {currency}
              </span>
              <input
                type="number"
                min={1}
                className="af-input pl-14 text-2xl font-heading font-bold"
                value={topup}
                onChange={(e) => setTopup(e.target.value)}
                data-testid="topup-input"
              />
            </div>
            <button
              onClick={fund}
              disabled={busy}
              className="af-btn-primary whitespace-nowrap"
              data-testid="topup-btn"
            >
              {busy ? "Funding…" : `Fund ${fmtMoney(topup, currency)}`}
            </button>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {[5000, 25000, 100000, 500000].map((v) => (
              <button
                key={v}
                onClick={() => setTopup(v)}
                className="af-chip hover:bg-brand/10 hover:text-brand hover:border-brand transition"
                data-testid={`quick-amount-${v}`}
              >
                +{fmtMoney(v, currency)}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "withdraw" && (
        <div className="af-card p-6" data-testid="withdraw-drawer">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
              <ArrowUp className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-ink">Withdraw to bank</h3>
              <div className="text-xs text-ink-muted">
                Funds land in your account within 24h. Max:{" "}
                <span className="font-bold text-ink">{fmtMoney(w.available, currency)}</span>
              </div>
            </div>
            <button
              onClick={() => setView("idle")}
              className="text-sm text-ink-muted hover:text-ink"
              data-testid="cancel-withdraw"
            >
              Cancel
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Bank account
              </div>
              <input
                className="af-input"
                placeholder="e.g. 0123456789"
                value={payout.bank_account}
                onChange={(e) => setPayout({ ...payout, bank_account: e.target.value })}
                data-testid="payout-bank"
              />
            </label>
            <label className="block">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Amount
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">
                  {currency}
                </span>
                <input
                  type="number"
                  min={1}
                  max={w.available}
                  className="af-input pl-14"
                  placeholder="0"
                  value={payout.amount || ""}
                  onChange={(e) => setPayout({ ...payout, amount: Number(e.target.value) })}
                  data-testid="payout-amount"
                />
              </div>
            </label>
          </div>

          <button
            onClick={requestPayout}
            disabled={busy}
            className="af-btn-primary w-full mt-4"
            data-testid="payout-btn"
          >
            {busy ? "Requesting…" : "Request payout"}
          </button>
        </div>
      )}

      {/* ========== Escrow Status Card ========== */}
      {w.escrow_held > 0 && (
        <div
          className="af-card p-6 border-l-4 border-l-gold"
          data-testid="escrow-status-card"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold/10 text-gold-dark grid place-items-center flex-shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-bold text-ink">Escrow status</h3>
                <span className="af-badge-pending">Active</span>
              </div>
              <div className="text-sm text-ink-muted mt-1">
                <span className="font-heading font-extrabold text-ink text-lg">
                  {fmtMoney(w.escrow_held, currency)}
                </span>{" "}
                is currently held against active orders. Funds release automatically when each
                order is confirmed delivered.
              </div>
            </div>
          </div>
        </div>
      )}

      <TrustStrip testId="wallet-trust-banner" />

      {/* ========== Transaction History ========== */}
      <section className="af-card overflow-hidden" data-testid="ledger-section">
        <div className="p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <WalletIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Transaction history</h3>
              <div className="text-xs text-ink-muted">
                {data.entries.length} entries on immutable ledger
              </div>
            </div>
          </div>
          {data.entries.length > 0 && (
            <span className="af-chip text-[10px]">
              <Banknote className="w-3 h-3" /> ledger-verified
            </span>
          )}
        </div>
        {data.entries.length === 0 ? (
          <div className="p-10 text-center text-ink-muted">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
            No transactions yet. Fund your wallet to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr
                    key={e.id}
                    className="hover:bg-zinc-50/50 transition"
                    data-testid={`ledger-${e.id}`}
                  >
                    <td className="p-4 text-ink-muted whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="p-4">
                      <span className="af-chip capitalize">{e.kind.replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4 text-ink-soft">{e.note}</td>
                    <td
                      className={`p-4 text-right font-heading font-extrabold whitespace-nowrap ${
                        e.direction === "credit" ? "text-brand" : "text-rose-600"
                      }`}
                    >
                      {e.direction === "credit" ? "+" : "−"}
                      {fmtMoney(e.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
