import { Award, Sparkles, ShieldCheck, HeartHandshake } from "lucide-react";

const CONFIG = {
  top_supplier: {
    label: "Top supplier",
    icon: Award,
    cls: "bg-gold/10 text-gold-ink border-gold/30",
  },
  rising_star: {
    label: "Rising star",
    icon: Sparkles,
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  verified_pro: {
    label: "Verified pro",
    icon: ShieldCheck,
    cls: "bg-brand/10 text-brand border-brand/25",
  },
  trusted_by_buyers: {
    label: "Trusted by buyers",
    icon: HeartHandshake,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export default function SupplierBadge({ type, compact = false }) {
  const cfg = CONFIG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-full font-semibold ${cfg.cls} ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      data-testid={`supplier-badge-${type}`}
    >
      <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {cfg.label}
    </span>
  );
}
