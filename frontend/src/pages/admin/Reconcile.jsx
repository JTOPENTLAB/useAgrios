import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  RefreshCcw,
  CheckCircle2,
  Clock,
  Webhook,
  Wallet as WalletIcon,
  ShieldAlert,
  ArrowRight,
  HeartPulse,
} from "lucide-react";
import api from "@/lib/api";

const BUCKETS = [
  { key: "stale_payments", icon: Clock, title: "Stale payments", tone: "amber", hint: "Pending > 30min — expect webhook or auto-verify by now." },
  { key: "escrow_orphans", icon: WalletIcon, title: "Escrow orphans", tone: "rose", hint: "Orders marked funded but missing ledger entry." },
  { key: "stale_payouts", icon: ShieldAlert, title: "Stale payouts", tone: "gold", hint: "Payout requests pending > 24h — admin review needed." },
  { key: "unprocessed_webhooks", icon: Webhook, title: "Unprocessed webhooks", tone: "blue", hint: "Received but never transitioned to 'processed'." },
];

export default function Reconcile() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/reconcile").then((r) => setData(r.data)),
      api.get("/admin/audit?limit=20").then((r) => setAudit(r.data || [])),
      fetch((process.env.REACT_APP_BACKEND_URL || "") + "/api/ready")
        .then((r) => r.json().then((j) => ({ ...j, status: r.status })))
        .then(setHealth)
        .catch(() => setHealth(null)),
    ]).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const toneMap = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    gold: "bg-gold/10 text-gold-dark border-gold/30",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="space-y-6" data-testid="admin-reconcile-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Production ops</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">Reconciliation</h1>
          <p className="text-ink-muted mt-1">
            Nightly financial mismatches · webhook health · admin audit · system readiness.
          </p>
        </div>
        <button onClick={load} className="af-btn-secondary" data-testid="reconcile-refresh">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* System health */}
      <section className="af-card p-5 flex items-start gap-4" data-testid="system-health">
        <div className={`w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ${health?.ok ? "bg-brand/10 text-brand" : "bg-rose-50 text-rose-600"}`}>
          <HeartPulse className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-ink">
            System health: {health?.ok ? "OK" : health ? "Degraded" : "unknown"}
          </div>
          {health?.checks && (
            <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>mongo: <span className="font-bold text-ink">{health.checks.mongo}</span></span>
              <span>email: <span className="font-bold text-ink uppercase">{health.checks.email_provider}</span></span>
              <span>payments: <span className="font-bold text-ink uppercase">{health.checks.payment_provider}</span></span>
            </div>
          )}
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {BUCKETS.map((b) => {
          const count = counts[b.key] ?? 0;
          const Icon = b.icon;
          return (
            <div key={b.key} className={`af-card p-5 border-l-4 ${toneMap[b.tone].replace("bg-", "border-l-").replace("-50", "-500").replace("/10", "")}`} data-testid={`bucket-${b.key}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl grid place-items-center ${toneMap[b.tone]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-bold text-ink text-lg">{count}</div>
                  <div className="text-xs text-ink-muted font-semibold uppercase tracking-wider">{b.title}</div>
                </div>
              </div>
              <div className="text-[11px] text-ink-muted mt-2 leading-relaxed">{b.hint}</div>
            </div>
          );
        })}
      </section>

      {total === 0 && !loading && (
        <div className="af-card p-6 bg-brand/5 border-l-4 border-l-brand flex items-center gap-3" data-testid="all-clear">
          <CheckCircle2 className="w-6 h-6 text-brand" />
          <div>
            <div className="font-heading font-bold text-ink">All clear</div>
            <div className="text-sm text-ink-muted">No mismatches detected in any bucket.</div>
          </div>
        </div>
      )}

      {/* Detail tables */}
      {BUCKETS.map((b) => {
        const items = data?.[b.key] || [];
        if (items.length === 0) return null;
        return (
          <section key={b.key} className="af-card overflow-hidden" data-testid={`bucket-detail-${b.key}`}>
            <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${toneMap[b.tone].split(" ")[1]}`} />
              <h3 className="font-heading font-bold text-ink">{b.title} ({items.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
                  <tr>
                    <th className="text-left p-3">ID / reference</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.slice(0, 20).map((r, i) => (
                    <tr key={r.id || r.reference || i} className="hover:bg-zinc-50/50">
                      <td className="p-3 font-mono text-[11px]">{r.id || r.reference || r.event_id || "—"}</td>
                      <td className="p-3"><span className="af-chip capitalize">{r.status || r.escrow_status || "—"}</span></td>
                      <td className="p-3 text-ink-muted">{(r.created_at || r.received_at || "").slice(0, 19)}</td>
                      <td className="p-3 text-right font-heading font-bold">
                        {r.amount ? `${r.currency || ""} ${Number(r.amount).toLocaleString()}` : r.total ? `${r.currency || ""} ${Number(r.total).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* Admin audit trail */}
      <section className="af-card overflow-hidden" data-testid="admin-audit-section">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-heading font-bold text-ink">Recent admin actions</h3>
          <span className="af-chip text-[10px]">Append-only audit</span>
        </div>
        {audit.length === 0 ? (
          <div className="p-10 text-center text-ink-muted text-sm">No admin actions logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
                <tr>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Admin</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Resource</th>
                  <th className="text-left p-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {audit.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50">
                    <td className="p-3 text-ink-muted whitespace-nowrap">{(r.at || "").slice(0, 19)}</td>
                    <td className="p-3 font-mono text-[11px]">{(r.admin_id || "").slice(0, 10)}…</td>
                    <td className="p-3"><span className="af-chip text-[10px]">{r.action}</span></td>
                    <td className="p-3">{r.resource_type} <span className="text-ink-muted font-mono text-[10px]">{(r.resource_id || "").slice(0, 10)}</span></td>
                    <td className="p-3 text-ink-muted">{r.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-[11px] text-ink-muted text-center pt-2">
        Report generated at {data?.generated_at || "—"}. Run the job from your CRON or ops playbook daily.
      </div>
    </div>
  );
}
