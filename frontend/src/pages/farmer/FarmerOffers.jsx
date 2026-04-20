import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";
import { EmptyState } from "./FarmerDashboard";

export default function FarmerOffers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/offers/farmer").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const act = async (id, action) => {
    try {
      await api.post(`/offers/${id}/action`, { action });
      toast.success(`Offer ${action}ed`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="offers-page">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Offers inbox</h1>
        <p className="text-ink-muted mt-1">Review offers from buyers. Accept the ones that work for you.</p>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="af-card p-10">
          <EmptyState icon={Inbox} title="No offers yet" text="When buyers offer prices on your listings, they'll show up here." />
        </div>
      ) : (
        <div className="af-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
              <tr>
                <th className="text-left p-4">Buyer</th>
                <th className="text-left p-4">Crop</th>
                <th className="text-right p-4">Qty</th>
                <th className="text-right p-4">Offered price</th>
                <th className="text-right p-4">Total</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((o) => (
                <tr key={o.id} className="text-sm hover:bg-zinc-50/50 transition" data-testid={`offer-row-${o.id}`}>
                  <td className="p-4">
                    <div className="font-semibold text-ink">{o.buyer_name}</div>
                    <div className="text-xs text-ink-muted">{fmtDate(o.created_at)}</div>
                  </td>
                  <td className="p-4 font-medium">{o.crop}</td>
                  <td className="p-4 text-right">{o.quantity_kg}kg</td>
                  <td className="p-4 text-right font-semibold">{fmtNGN(o.price_per_kg)}/kg</td>
                  <td className="p-4 text-right font-heading font-bold">{fmtNGN(o.price_per_kg * o.quantity_kg)}</td>
                  <td className="p-4">
                    {o.status === "pending" && <span className="af-badge-pending">Pending</span>}
                    {o.status === "accepted" && <span className="af-badge-verified">Accepted</span>}
                    {o.status === "rejected" && <span className="af-chip">Rejected</span>}
                  </td>
                  <td className="p-4 text-right">
                    {o.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => act(o.id, "accept")} className="af-btn-primary py-1.5 px-3 text-xs" data-testid={`accept-${o.id}`}>Accept</button>
                        <button onClick={() => act(o.id, "reject")} className="af-btn-ghost py-1.5 px-3 text-xs" data-testid={`reject-${o.id}`}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
