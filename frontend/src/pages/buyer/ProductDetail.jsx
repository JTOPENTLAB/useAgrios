import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, MapPin, Sprout, Truck, CheckCircle2, Eye, Bookmark } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import RatingPill from "@/components/RatingPill";
import DeliveryBadge from "@/components/DeliveryBadge";
import TrustStrip from "@/components/TrustStrip";
import ProductRecommendations from "@/components/ProductRecommendations";
import { pushRecentlyViewed } from "@/components/RecentlyViewed";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [l, setL] = useState(null);
  const [qty, setQty] = useState(50);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`).then((r) => {
      setL(r.data);
      pushRecentlyViewed(r.data);
    });
    if (user?.role === "buyer") {
      api
        .get("/listings/saved")
        .then((r) => setIsSaved(r.data.some((x) => x.id === id)))
        .catch(() => {});
    }
  }, [id, user]);

  if (!l) return <div className="af-card p-10 text-center text-ink-muted">Loading…</div>;

  const currency = l.currency || "NGN";
  const total = qty * l.price_per_kg;
  const commission = total * 0.05;
  const farmer = total - commission;

  const toggleSave = async () => {
    try {
      const { data } = await api.post(`/listings/${l.id}/save`);
      setIsSaved(data.saved);
      toast.success(data.saved ? "Saved" : "Unsaved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const buyNow = async () => {
    if (!addr) {
      toast.error("Enter a delivery address");
      return;
    }
    if (qty > l.quantity_kg) {
      toast.error("Quantity exceeds availability");
      return;
    }
    setBusy(true);
    try {
      const { data: order } = await api.post("/orders", {
        listing_id: l.id,
        quantity_kg: qty,
        delivery_address: addr,
      });
      await api.post(`/orders/${order.id}/fund-escrow`);
      toast.success("Escrow funded. Order created!");
      nav(`/app/orders/${order.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const makeOffer = async () => {
    try {
      await api.post("/offers", {
        listing_id: l.id,
        quantity_kg: qty,
        price_per_kg: l.price_per_kg * 0.9,
        message: "Interested — open to negotiation.",
      });
      toast.success("Offer sent to farmer");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="product-detail-page">
      <div className="lg:col-span-2 space-y-6">
        <TrustStrip testId="detail-trust-strip" />
        <div className="af-card overflow-hidden">
          <div className="aspect-[16/10] bg-zinc-100">
            {l.image_url ? (
              <img src={l.image_url} alt={l.crop} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-ink-muted"><Sprout className="w-16 h-16" /></div>
            )}
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-brand">{l.crop}</div>
                <h1 className="font-heading font-extrabold text-3xl text-ink mt-1">{l.crop} · {l.variety || "Standard"}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-ink-muted flex-wrap">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {l.location}</span>
                  <span className="af-chip">Grade {l.grade}</span>
                  {l.farmer_verified && <span className="af-badge-verified"><ShieldCheck className="w-3 h-3" /> Verified farmer</span>}
                  <RatingPill seed={l.farmer_id || l.id} verified={l.farmer_verified} testId="detail-rating" />
                  <DeliveryBadge testId="detail-delivery" />
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-ink-muted" data-testid="social-proof-strip">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {l.views || 0} views</span>
                  <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> {l.saves || 0} buyers saved</span>
                  {(l.views || 0) > 5 && <span className="af-badge-pending">🔥 Trending</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-heading font-extrabold text-3xl text-ink">{fmtMoney(l.price_per_kg, currency)}</div>
                <div className="text-xs text-ink-muted">per kg</div>
              </div>
            </div>
            <p className="mt-5 text-ink-soft leading-relaxed">{l.description || "No additional description."}</p>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-100">
              <div><div className="text-xs text-ink-muted">Available</div><div className="font-heading font-bold">{l.quantity_kg.toLocaleString()}kg</div></div>
              <div><div className="text-xs text-ink-muted">Farmer</div><div className="font-heading font-bold">{l.farmer_name}</div></div>
              <div><div className="text-xs text-ink-muted">Posted</div><div className="font-heading font-bold text-sm">{new Date(l.created_at).toLocaleDateString()}</div></div>
            </div>
          </div>
        </div>

        <div className="af-card p-6">
          <h3 className="font-heading font-bold mb-4">Why this is protected</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              [ShieldCheck, "Escrow-locked", "Your payment is held safely until you confirm delivery."],
              [Truck, "Logistics arranged", "Verified transporters pick up and deliver with proof."],
              [CheckCircle2, "Dispute support", "AGRIOS team resolves issues fairly."],
            ].map(([Ic, t, d]) => (
              <div key={t} className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center flex-shrink-0"><Ic className="w-5 h-5" /></div>
                <div>
                  <div className="font-semibold text-ink text-sm">{t}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProductRecommendations listingId={l.id} />
      </div>

      <div className="space-y-4">
        <div className="af-card p-6 sticky top-20" data-testid="checkout-panel">
          <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">Place order</div>
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-semibold text-ink-soft mb-1">Quantity (kg)</div>
              <input type="number" min={1} max={l.quantity_kg} value={qty} onChange={(e) => setQty(+e.target.value)} className="af-input" data-testid="qty-input" />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-ink-soft mb-1">Delivery address</div>
              <input className="af-input" placeholder="Warehouse / drop address" value={addr} onChange={(e) => setAddr(e.target.value)} data-testid="address-input" />
            </label>
          </div>
          <div className="border-t border-zinc-100 mt-5 pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span className="font-semibold">{fmtMoney(total, currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Platform fee (5%)</span><span>{fmtMoney(commission, currency)}</span></div>
            <div className="flex justify-between pt-2 border-t border-zinc-100"><span className="font-heading font-bold">Farmer receives</span><span className="font-heading font-bold text-brand">{fmtMoney(farmer, currency)}</span></div>
          </div>
          <div className="mt-5 space-y-2">
            <button disabled={busy} onClick={buyNow} className="af-btn-primary w-full" data-testid="buy-now-btn">
              {busy ? "Funding escrow…" : "Buy now · Fund escrow"}
            </button>
            <button onClick={makeOffer} className="af-btn-secondary w-full" data-testid="make-offer-btn">
              Make an offer
            </button>
            {user?.role === "buyer" && (
              <button onClick={toggleSave} className="af-btn-ghost w-full text-sm" data-testid="detail-save-btn">
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-brand text-brand" : ""}`} /> {isSaved ? "Saved" : "Save for later"}
              </button>
            )}
          </div>
          <div className="text-[10px] text-ink-muted text-center mt-3 leading-relaxed">
            Escrow is released to the farmer only after you confirm delivery.
          </div>
        </div>
      </div>
    </div>
  );
}
