import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, MapPin, Package } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";

const BADGE = {
  pending: "af-badge-pending",
  accepted: "af-badge-info",
  picked_up: "af-badge-info",
  in_transit: "af-badge-info",
  delivered: "af-badge-verified",
};

export default function LogisticsJobs() {
  const [jobs, setJobs] = useState([]);
  const load = () => api.get("/logistics/jobs").then((r) => setJobs(r.data));
  useEffect(() => { load(); }, []);

  const accept = async (id) => {
    try {
      await api.post(`/logistics/jobs/${id}/accept`);
      toast.success("Job accepted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.post(`/logistics/jobs/${id}/status`, { status });
      toast.success(`Marked ${status.replace(/_/g, " ")}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="logistics-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">Logistics</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Jobs board</h1>
        <p className="text-ink-muted mt-1">Accept pickups. Move produce. Get paid.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="af-card p-10 text-center">
          <Truck className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No jobs yet</div>
          <div className="text-sm text-ink-muted">When orders are funded, jobs appear here.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 af-stagger">
          {jobs.map((j) => (
            <div key={j.id} className="af-card p-5" data-testid={`job-card-${j.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-brand">Order #{j.order_id.slice(0, 8).toUpperCase()}</div>
                  <h3 className="font-heading font-bold text-lg mt-1">{j.crop} · {j.quantity_kg}kg</h3>
                </div>
                <span className={BADGE[j.status] || "af-chip"}>{j.status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2 text-ink-muted"><MapPin className="w-4 h-4 text-brand" /> <span>Pickup: <b className="text-ink">{j.pickup_from}</b></span></div>
                <div className="flex gap-2 text-ink-muted"><Package className="w-4 h-4 text-gold-dark" /> <span>Deliver to: <b className="text-ink">{j.deliver_to}</b></span></div>
                <div className="flex justify-between mt-2 pt-2 border-t border-zinc-100">
                  <span className="text-ink-muted text-xs">{fmtDate(j.created_at)}</span>
                  <span className="font-heading font-bold text-brand">{fmtNGN(j.payout)}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                {j.status === "pending" && (
                  <button onClick={() => accept(j.id)} className="af-btn-primary flex-1 py-2 text-sm" data-testid={`accept-job-${j.id}`}>Accept job</button>
                )}
                {j.status === "accepted" && (
                  <button onClick={() => setStatus(j.id, "picked_up")} className="af-btn-primary flex-1 py-2 text-sm" data-testid={`pickup-${j.id}`}>Mark picked up</button>
                )}
                {j.status === "picked_up" && (
                  <button onClick={() => setStatus(j.id, "in_transit")} className="af-btn-primary flex-1 py-2 text-sm" data-testid={`transit-${j.id}`}>Mark in transit</button>
                )}
                {j.status === "in_transit" && (
                  <button onClick={() => setStatus(j.id, "delivered")} className="af-btn-primary flex-1 py-2 text-sm" data-testid={`deliver-${j.id}`}>Mark delivered</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
