export default function StatCard({ label, value, sub, tone = "brand", testId }) {
  const tones = {
    brand: "bg-brand/10 text-brand",
    gold: "bg-gold/10 text-gold-dark",
    blue: "bg-blue-500/10 text-blue-700",
    rose: "bg-rose-500/10 text-rose-700",
    zinc: "bg-zinc-100 text-ink-soft",
  };
  return (
    <div className="af-card p-5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>
        <span className={`w-2 h-2 rounded-full ${tones[tone].split(" ")[0]}`} />
      </div>
      <div className="mt-3 font-heading font-extrabold text-2xl sm:text-3xl text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </div>
  );
}
