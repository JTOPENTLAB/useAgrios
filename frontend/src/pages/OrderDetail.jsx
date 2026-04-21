import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, MapPin, Clock, Repeat2 } from "lucide-react";
import api, { fmtNGN, fmtDate } from "@/lib/api";
import EscrowTimeline from "@/components/EscrowTimeline";
import { useAuth } from "@/context/AuthContext";

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const load = () => api.get(`/orders/${id}`).then((r) => setO(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!o) return <div className="af-card p-10 text-center text-ink-muted">Loading…</div>;

  const fundEscrow = async () => {
    try {
      await api.post(`/orders/${o.id}/fund-escrow`);
      toast.success("Escrow funded");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const confirm = async () => {
    try {
      await api.post(`/orders/${o.id}/confirm-delivery`);
      toast.success("Delivery confirmed. Payment released.");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const createDispute = async () => {
    try {
      await api.post("/disputes", { order_id: o.id, reason: disputeReason, description: disputeDesc });
      toast.success("Dispute raised. Admin will review.");
      setShowDispute(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const isBuyer = user.id === o.buyer_id;

  return (
    <div className="space-y-6" data-testid="order-detail-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">Order #{o.id.slice(0, 8).toUpperCase()}</div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">{o.crop} · {o.quantity_kg}kg</h1>
          <p className="text-ink-muted mt-1">Created {fmtDate(o.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {isBuyer && o.status === "completed" && (
            <button
              onClick={async () => {
                try {
                  const { data } = await api.post(`/orders/${o.id}/reorder`);
                  toast.success(data.auto_funded ? "Reorder placed & escrow funded!" : "Reorder created — fund escrow to confirm");
                  nav(`/app/orders/${data.order_id}`);
                } catch (err) {
                  toast.error(err?.response?.data?.detail || "Reorder failed");
                }
              }}
              className="af-btn-primary"
              data-testid="reorder-detail-btn"
            >
              <Repeat2 className="w-4 h-4" /> Reorder
            </button>
          )}
          {isBuyer && o.status === "awaiting_payment" && (
            <button onClick={fundEscrow} className="af-btn-primary" data-testid="fund-escrow-btn">Fund escrow</button>
          )}
          {isBuyer && o.status === "delivered" && (
            <button onClick={confirm} className="af-btn-primary" data-testid="confirm-delivery-btn">Confirm delivery</button>
          )}
          {o.status !== "completed" && o.status !== "cancelled" && (
            <button onClick={() => setShowDispute((v) => !v)} className="af-btn-ghost text-rose-600" data-testid="raise-dispute-btn">
              <AlertCircle className="w-4 h-4" /> Raise dispute
            </button>
          )}
        </div>
      </div>

      <EscrowTimeline status={o.status} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="af-card p-6 lg:col-span-2 space-y-4">
          <h3 className="font-heading font-bold text-lg">Activity timeline</h3>
          <div className="space-y-3">
            {(o.timeline || []).map((t, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-brand/10 text-brand grid place-items-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-ink">{t.event.replace(/_/g, " ")}</div>
                  <div className="text-xs text-ink-muted">{fmtDate(t.ts)} — by {t.by}{t.notes && ` — ${t.notes}`}</div>
                </div>
              </div>
            ))}
          </div>
          {showDispute && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-4 space-y-3" data-testid="dispute-form">
              <div className="font-heading font-bold text-rose-700">Raise a dispute</div>
              <input className="af-input" placeholder="Reason (e.g., short delivery, quality)" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} data-testid="dispute-reason" />
              <textarea className="af-input min-h-[80px]" placeholder="Describe what happened…" value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} data-testid="dispute-desc" />
              <button onClick={createDispute} className="af-btn-primary" data-testid="dispute-submit">Submit</button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="af-card p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">Financials</div>
            <div className="space-y-2 text-sm">
              <Row label="Price per kg" value={fmtNGN(o.price_per_kg)} />
              <Row label="Quantity" value={`${o.quantity_kg}kg`} />
              <Row label="Subtotal" value={fmtNGN(o.total)} bold />
              <Row label="Platform fee" value={fmtNGN(o.commission)} />
              <Row label="Farmer receives" value={fmtNGN(o.farmer_amount)} accent />
            </div>
          </div>
          <div className="af-card p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">Parties</div>
            <div className="space-y-3 text-sm">
              <div><div className="text-xs text-ink-muted">Buyer</div><div className="font-semibold">{o.buyer_name}</div></div>
              <div><div className="text-xs text-ink-muted">Farmer</div><div className="font-semibold">{o.farmer_name}</div></div>
              {o.logistics_name && <div><div className="text-xs text-ink-muted">Logistics</div><div className="font-semibold">{o.logistics_name}</div></div>}
              <div><div className="text-xs text-ink-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> Delivery</div><div className="font-semibold">{o.delivery_address}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, bold, accent }) => (
  <div className="flex justify-between">
    <span className="text-ink-muted">{label}</span>
    <span className={`${bold ? "font-heading font-bold" : ""} ${accent ? "text-brand font-heading font-bold" : "text-ink"}`}>{value}</span>
  </div>
);
