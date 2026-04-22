import { useEffect, useState } from "react";
import { Wallet as WalletIcon, ShieldCheck, Eye, Layers, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Global wallet-fund modal. Triggered when user tries to invest but has insufficient
 * balance, or from the "Fund wallet to continue" CTA on first-investment screen.
 */
export default function WalletFundModal({ open, onClose, recommended = 50000, onFunded, ctaLabel = "Continue" }) {
  const { user, setUser } = useAuth();
  const currency = user?.currency || "NGN";
  const [amount, setAmount] = useState(String(recommended));
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!open) return;
    api
      .get("/wallet")
      .then((r) => setBalance(Number(r.data?.wallet?.available || 0)))
      .catch(() => setBalance(0));
  }, [open]);

  if (!open) return null;

  const presets = [10000, 50000, 100000];

  const fund = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/fund", { amount: n });
      toast.success(`${fmtMoney(n, currency)} added to your wallet`);
      setBalance((data?.wallet?.available) ?? ((balance || 0) + n));
      // Update local auth cache so kyc + balance propagates
      if (user) {
        const refreshed = { ...user, wallet_balance: (user.wallet_balance || 0) + n };
        setUser(refreshed);
        localStorage.setItem("agriflow_user", JSON.stringify(refreshed));
      }
      onFunded && onFunded(n);
      onClose && onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Funding failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm"
      data-testid="wallet-fund-modal"
      onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink"
          data-testid="wallet-modal-close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
          <WalletIcon className="w-3.5 h-3.5" /> Fund your wallet
        </div>
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mt-2">
          Top up to continue.
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          Most users start with ₦50,000.
        </p>

        <div className="mt-5 p-4 rounded-2xl bg-brand/5 border border-brand/15">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand">
            Current balance
          </div>
          <div className="font-heading font-extrabold text-2xl text-ink mt-1" data-testid="wallet-modal-balance">
            {balance === null ? "…" : fmtMoney(balance, currency)}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-ink-soft mb-2">
            Choose a starter amount
          </div>
          <div className="grid grid-cols-3 gap-2" data-testid="wallet-modal-presets">
            {presets.map((n) => {
              const active = String(n) === amount;
              const recommended = n === 50000;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  className={`rounded-2xl p-3 border-2 text-left transition relative ${
                    active
                      ? "border-brand bg-brand/5"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  data-testid={`wallet-preset-${n}`}
                >
                  {recommended && (
                    <span className="absolute -top-2 left-2 text-[9px] font-bold uppercase bg-brand text-white rounded-full px-1.5 py-0.5">
                      Recommended
                    </span>
                  )}
                  <div className="font-heading font-extrabold text-lg text-ink">
                    {fmtMoney(n, currency)}
                  </div>
                </button>
              );
            })}
          </div>
          <input
            type="number"
            min="0"
            step="any"
            className="af-input mt-3"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Or enter any amount"
            data-testid="wallet-modal-custom-amount"
          />
        </div>

        <div
          className="mt-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-2"
          data-testid="wallet-trust-panel"
        >
          <TrustLine icon={Layers} text="Funds released in stages — never all at once." />
          <TrustLine icon={ShieldCheck} text="Verified farm partners — KYC'd and site-visited." />
          <TrustLine icon={Eye} text="Transparent tracking — see where your money is at every step." />
          <div className="text-[11px] text-ink-muted pt-1 italic">
            "You will always see where your money is going."
          </div>
        </div>

        <button
          onClick={fund}
          disabled={busy || !amount}
          className="af-btn-primary w-full mt-5 disabled:opacity-60"
          data-testid="wallet-modal-fund-btn"
        >
          {busy ? "Funding…" : (
            <>
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TrustLine({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-2 text-sm text-ink-soft">
      <Icon className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
