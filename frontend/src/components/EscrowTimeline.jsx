import { CheckCircle2, Clock, Truck, PackageCheck } from "lucide-react";

const STEPS = [
  { key: "awaiting_payment", label: "Created", icon: Clock },
  { key: "escrow_funded", label: "Escrow funded", icon: CheckCircle2 },
  { key: "in_logistics", label: "Logistics assigned", icon: Truck },
  { key: "in_transit", label: "In transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const idx = (status) => {
  const i = STEPS.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
};

export default function EscrowTimeline({ status }) {
  const current = idx(status);
  return (
    <div className="af-card p-5" data-testid="escrow-timeline">
      <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-4">Escrow & delivery flow</div>
      <div className="flex items-start justify-between gap-2">
        {STEPS.map((s, i) => {
          const done = i <= current;
          const active = i === current;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-9 h-9 rounded-full grid place-items-center transition ${
                  done ? "bg-brand text-white" : "bg-zinc-100 text-ink-muted"
                } ${active ? "ring-4 ring-brand/15" : ""}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className={`text-[10px] mt-2 text-center font-medium ${done ? "text-ink" : "text-ink-muted"}`}>
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`absolute hidden ${done ? "bg-brand" : "bg-zinc-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
