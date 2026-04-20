import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";

const STATUS_STYLES = {
  awaiting_payment: "af-badge-pending",
  escrow_funded: "af-badge-info",
  in_logistics: "af-badge-info",
  in_transit: "af-badge-info",
  delivered: "af-badge-pending",
  completed: "af-badge-verified",
  cancelled: "af-chip",
  disputed: "af-badge-pending",
};

export default function BuyerOrders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Orders</h1>
        <p className="text-ink-muted mt-1">Track every order from creation to delivery.</p>
      </div>

      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="af-card p-10 text-center">
          <Package className="w-10 h-10 mx-auto text-ink-muted" />
          <div className="font-heading font-bold mt-3">No orders yet</div>
          <div className="text-sm text-ink-muted">Your orders will appear here once you start transacting.</div>
        </div>
      ) : (
        <div className="af-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
              <tr>
                <th className="text-left p-4">Order</th>
                <th className="text-left p-4">Crop</th>
                <th className="text-right p-4">Qty</th>
                <th className="text-right p-4">Total</th>
                <th className="p-4">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((o) => (
                <tr key={o.id} className="text-sm hover:bg-zinc-50/50" data-testid={`order-row-${o.id}`}>
                  <td className="p-4">
                    <div className="font-semibold text-ink">#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-xs text-ink-muted">{fmtDate(o.created_at)}</div>
                  </td>
                  <td className="p-4 font-medium">{o.crop}</td>
                  <td className="p-4 text-right">{o.quantity_kg}kg</td>
                  <td className="p-4 text-right font-heading font-bold">{fmtNGN(o.total)}</td>
                  <td className="p-4">
                    <span className={STATUS_STYLES[o.status] || "af-chip"}>{o.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="p-4 text-right">
                    <Link to={`/app/orders/${o.id}`} className="text-brand font-semibold text-sm" data-testid={`view-order-${o.id}`}>View →</Link>
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
