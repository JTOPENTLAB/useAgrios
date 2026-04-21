import { useState } from "react";
import { AlertTriangle, ShieldCheck, Lock } from "lucide-react";

/**
 * First-invest risk acknowledgement gate.
 * Stored in localStorage — gates the invest CTA until acknowledged.
 */

const LS_KEY = "agrios_investor_ack_v1";

export function hasAcknowledged() {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAcknowledged() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function RiskAcknowledgementModal({ open, onClose, onConfirm }) {
  const [accredited, setAccredited] = useState(false);
  const [understand, setUnderstand] = useState(false);

  if (!open) return null;
  const canConfirm = accredited && understand;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
      data-testid="risk-ack-modal"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-lift overflow-hidden">
        <div className="bg-gradient-to-br from-gold/15 to-amber-100 p-5 border-b border-gold/20 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold text-ink grid place-items-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">
              Before your first investment
            </div>
            <div className="font-heading font-extrabold text-xl text-ink mt-0.5">
              What you need to know
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <Point
            icon={ShieldCheck}
            title="Escrow protects capital movement — not returns"
            text="AGRIOS escrow secures how your money moves to the farmer. Agricultural returns depend on weather, yield, and market prices, which are real risks."
          />
          <Point
            icon={AlertTriangle}
            title="Target returns are targets, not guarantees"
            text="Target returns reflect the farmer's best-case projection. Actual payouts may be lower, delayed, or in rare cases zero."
          />
          <Point
            icon={Lock}
            title="Your capital is locked for the cycle"
            text="You cannot withdraw an investment once funded. Returns are released at maturity to your AGRIOS wallet."
          />

          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accredited}
                onChange={(e) => setAccredited(e.target.checked)}
                className="mt-1 w-4 h-4 accent-brand"
                data-testid="ack-accredited"
              />
              <span className="text-sm text-ink-soft leading-relaxed">
                I confirm I am investing my own funds and am not using capital
                I cannot afford to put at risk.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={understand}
                onChange={(e) => setUnderstand(e.target.checked)}
                className="mt-1 w-4 h-4 accent-brand"
                data-testid="ack-understand"
              />
              <span className="text-sm text-ink-soft leading-relaxed">
                I understand that target returns are not guaranteed and that
                agricultural investments carry weather, yield, and market risks.
              </span>
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-100 flex gap-3 flex-wrap">
          <button
            onClick={onClose}
            className="af-btn-ghost flex-1 justify-center"
            data-testid="ack-cancel"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => {
              setAcknowledged();
              onConfirm?.();
            }}
            className="af-btn-primary flex-[2] justify-center disabled:opacity-50"
            data-testid="ack-confirm"
          >
            I understand · continue
          </button>
        </div>
      </div>
    </div>
  );
}

function Point({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-zinc-100 text-ink-soft grid place-items-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-heading font-bold text-ink text-sm">{title}</div>
        <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
