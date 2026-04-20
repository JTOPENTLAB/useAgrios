import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import api, { fmtDate } from "@/lib/api";

export default function AdminDisputes() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/disputes").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const resolve = async (id, resolution) => {
    try {
      await api.post(`/disputes/${id}/resolve`, { resolution, notes: "Resolved by admin" });
      toast.success("Dispute resolved");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-disputes-page">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Disputes</h1>
        <p className="text-ink-muted mt-1">Review and adjudicate escrow disputes fairly.</p>
      </div>

      {items.length === 0 ? (
        <div className="af-card p-10 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No disputes</div>
          <div className="text-sm text-ink-muted">All clear — transactions flowing smoothly.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((d) => (
            <div key={d.id} className="af-card p-5" data-testid={`dispute-${d.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-600">#{d.id.slice(0, 8).toUpperCase()}</div>
                  <h3 className="font-heading font-bold text-lg mt-1">{d.reason}</h3>
                  <p className="text-sm text-ink-soft mt-1">{d.description}</p>
                  <div className="text-xs text-ink-muted mt-2">Raised by {d.raised_by_name} · {fmtDate(d.created_at)}</div>
                </div>
                <span className={d.status === "open" ? "af-badge-pending" : "af-badge-verified"}>{d.status}</span>
              </div>
              {d.status === "open" && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
                  <button onClick={() => resolve(d.id, "release_to_farmer")} className="af-btn-primary py-2 text-sm" data-testid={`release-${d.id}`}>Release to farmer</button>
                  <button onClick={() => resolve(d.id, "refund_buyer")} className="af-btn-secondary py-2 text-sm" data-testid={`refund-${d.id}`}>Refund buyer</button>
                  <button onClick={() => resolve(d.id, "split")} className="af-btn-ghost py-2 text-sm" data-testid={`split-${d.id}`}>Split 50/50</button>
                </div>
              )}
              {d.status === "resolved" && (
                <div className="text-sm mt-3 pt-3 border-t border-zinc-100 text-ink-muted">
                  Resolution: <b className="text-ink">{d.resolution?.replace(/_/g, " ")}</b>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
