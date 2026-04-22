import { useState } from "react";
import { X, TrendingUp, Clock, Target, Layers, AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/api";

export default function InvestmentConfirmModal({ open, onClose, opp, amount, busy, onConfirm }) {
  const [ack, setAck] = useState(false);
  if (!open || !opp) return null;
  const pct = opp.target_return_pct || 0;
  const expectedPayout = amount * (1 + pct / 100);
  const returnAmount = expectedPayout - amount;
  const currency = opp.currency || "NGN";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm"
      data-testid="invest-confirm-modal"
      onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink"
          data-testid="confirm-modal-close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Confirm allocation
        </div>
        <h2 className="font-heading font-extrabold text-2xl text-ink mt-1">
          Review before you deploy.
        </h2>

        <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            Amount
          </div>
          <div className="font-heading font-extrabold text-3xl mt-1" data-testid="confirm-amount">
            {fmtMoney(amount, currency)}
          </div>
          <div className="text-sm text-white/80 mt-1">
            into "{opp.title}"
          </div>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <Row icon={Clock} label="Duration" value={`${opp.duration_months || 0} months`} testId="confirm-duration" />
          <Row icon={TrendingUp} label="Target return" value={`${pct}%`} testId="confirm-target" />
          <Row
            icon={Target}
            label="Expected payout"
            value={fmtMoney(expectedPayout, currency)}
            sub={`+${fmtMoney(returnAmount, currency)} gain`}
            testId="confirm-payout"
          />
          <Row icon={Layers} label="Released in" value="Milestones · monitored" testId="confirm-milestones" />
        </div>

        <label
          className="mt-5 flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer"
          data-testid="confirm-risk-ack"
        >
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-1 w-4 h-4 accent-amber-600"
            data-testid="confirm-risk-checkbox"
          />
          <span className="text-sm text-amber-900 leading-relaxed">
            <strong className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> I understand
            </strong>{" "}
            this investment carries risk. Returns are targets, not guarantees.
            Weather, market, and execution factors can affect outcomes.
          </span>
        </label>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 af-btn-ghost"
            data-testid="confirm-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ack || busy}
            className="flex-1 af-btn-primary disabled:opacity-50"
            data-testid="confirm-allocate-btn"
          >
            {busy ? "Allocating…" : "Allocate capital"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, sub, testId }) {
  return (
    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100" data-testid={testId}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="font-heading font-bold text-ink mt-0.5">{value}</div>
      {sub && <div className="text-xs text-brand font-semibold mt-0.5">{sub}</div>}
    </div>
  );
}
