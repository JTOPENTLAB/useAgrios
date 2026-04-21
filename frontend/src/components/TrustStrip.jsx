import { Lock, Shield } from "lucide-react";

/**
 * Reusable trust banner — surfaces escrow protection message across product,
 * checkout, wallet, order screens. Keeps the "funds-protected" promise visible
 * at every decision point.
 */
export default function TrustStrip({
  variant = "default",
  testId = "trust-strip",
  className = "",
}) {
  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-2 text-xs text-ink-muted ${className}`}
        data-testid={testId}
      >
        <Lock className="w-3.5 h-3.5 text-brand" />
        <span>
          Funds are securely held in escrow until delivery is confirmed.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`af-card p-4 flex items-center gap-3 border-l-4 border-l-brand bg-gradient-to-br from-brand/5 to-white ${className}`}
      data-testid={testId}
    >
      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center flex-shrink-0">
        <Shield className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="font-heading font-bold text-sm text-ink">
          Protected by AGRIOS escrow
        </div>
        <div className="text-xs text-ink-muted mt-0.5">
          Funds are held securely until delivery is confirmed — then released to the farmer.
        </div>
      </div>
    </div>
  );
}
