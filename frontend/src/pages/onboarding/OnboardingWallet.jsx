import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Wallet as WalletIcon, SkipForward, Landmark, CreditCard, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const QUICK_AMOUNTS = [5000, 25000, 100000, 500000];

export default function OnboardingWallet() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const nav = useNavigate();
  const { refreshState } = useOutletContext() || {};
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    api
      .get("/wallet")
      .then((r) => setBalance(Number(r.data?.wallet?.available || 0)))
      .catch(() => setBalance(0));
  }, []);

  const advance = async () => {
    try {
      await api.post("/onboarding/advance");
      refreshState && refreshState();
    } catch {
      // non-blocking
    }
    nav("/onboarding/invest");
  };

  const fund = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      await api.post("/wallet/fund", { amount: n });
      toast.success(`${fmtMoney(n, currency)} credited`);
      setBalance((b) => (b || 0) + n);
      setAmount("");
      advance();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="onboarding-wallet">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Step 3 · Wallet
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
          Fund your wallet.
        </h1>
        <p className="text-ink-muted mt-2">
          Start with any amount. Funds stay in your wallet until you deploy them
          — no lock-in.
        </p>
      </div>

      <div className="af-card p-6 sm:p-7 bg-gradient-to-br from-brand to-brand-dark text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/60">
            <WalletIcon className="w-3.5 h-3.5" /> Wallet balance
          </div>
          <div className="font-heading font-extrabold text-4xl mt-2" data-testid="wallet-balance">
            {balance === null ? "…" : fmtMoney(balance, currency)}
          </div>
          <div className="text-sm text-white/70 mt-1">
            AGRIOS-issued · Escrow-ready · Payouts in 24h
          </div>
        </div>
      </div>

      <div className="af-card p-6 sm:p-7">
        <div className="text-sm font-semibold text-ink-soft mb-2">
          How do you want to fund?
        </div>
        <div className="grid sm:grid-cols-2 gap-3" data-testid="wallet-methods">
          <button
            type="button"
            onClick={() => setMethod("bank")}
            className={`rounded-2xl p-4 border-2 transition text-left flex items-start gap-3 ${
              method === "bank" ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
            }`}
            data-testid="method-bank"
          >
            <Landmark className="w-5 h-5 text-brand mt-0.5" />
            <div>
              <div className="font-heading font-bold text-ink">Bank transfer</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Fast, no card required. Demo credits instantly.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMethod("card")}
            className={`rounded-2xl p-4 border-2 transition text-left flex items-start gap-3 ${
              method === "card" ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
            }`}
            data-testid="method-card"
          >
            <CreditCard className="w-5 h-5 text-brand mt-0.5" />
            <div>
              <div className="font-heading font-bold text-ink">Card</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Visa · Mastercard. Live rails launch soon — demo credits instantly.
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6">
          <label className="text-sm font-semibold text-ink-soft mb-1 block">
            Amount ({currency})
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Start with any amount"
            className="af-input"
            data-testid="wallet-amount-input"
          />
          <div className="flex gap-2 mt-2 flex-wrap" data-testid="wallet-quick-amounts">
            {QUICK_AMOUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className="text-xs font-semibold rounded-full bg-zinc-100 hover:bg-zinc-200 text-ink-soft px-3 py-1.5"
                data-testid={`quick-${n}`}
              >
                {fmtMoney(n, currency)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fund}
          disabled={busy || !amount}
          className="af-btn-primary w-full mt-5 disabled:opacity-60"
          data-testid="wallet-fund-btn"
        >
          {busy ? "Funding…" : (<>Fund wallet <ArrowRight className="w-4 h-4" /></>)}
        </button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={advance}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          data-testid="wallet-skip-btn"
        >
          <SkipForward className="w-3.5 h-3.5" /> Skip for later
        </button>
        <div className="text-xs text-ink-muted">
          You can fund later from the Wallet page.
        </div>
      </div>
    </div>
  );
}
