import { useEffect, useState } from "react";
import { Bell, BellOff, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function PriceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crop, setCrop] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const currency = user?.currency || "NGN";

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/alerts/price");
      setAlerts(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!crop.trim() || Number(price) <= 0) {
      toast.error("Enter a crop and a valid max price.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/alerts/price", {
        crop: crop.trim(),
        max_price_per_kg: Number(price),
        min_quantity_kg: Number(qty || 0),
      });
      toast.success("Price alert created");
      setCrop("");
      setPrice("");
      setQty("0");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/alerts/price/${id}`);
      toast.success("Alert removed");
      load();
    } catch {
      toast.error("Failed to remove alert");
    }
  };

  return (
    <div className="space-y-6" data-testid="price-alerts-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Automations
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">
          Price alerts
        </h1>
        <p className="text-ink-muted mt-1">
          Get a notification the moment a farmer posts a crop below your target
          price. Set it once, stay ahead of the market.
        </p>
      </div>

      <form
        onSubmit={create}
        className="af-card p-6 grid sm:grid-cols-[1.3fr_1fr_1fr_auto] gap-3 items-end"
        data-testid="create-alert-form"
      >
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Crop
          </label>
          <input
            className="af-input mt-1"
            placeholder="e.g. Tomato"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            data-testid="alert-crop-input"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Max price / kg ({currency})
          </label>
          <input
            className="af-input mt-1"
            type="number"
            min="1"
            placeholder="e.g. 900"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="alert-price-input"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Min quantity (kg)
          </label>
          <input
            className="af-input mt-1"
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            data-testid="alert-qty-input"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="af-btn-primary flex items-center gap-2 disabled:opacity-60"
          data-testid="alert-submit-btn"
        >
          <Plus className="w-4 h-4" />
          Create alert
        </button>
      </form>

      <div className="af-card p-6">
        <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand" />
          Your alerts ({alerts.length})
        </h3>
        {loading ? (
          <p className="text-ink-muted text-sm">Loading…</p>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center">
            <BellOff className="w-8 h-8 text-ink-muted mx-auto mb-2" />
            <p className="text-ink-muted text-sm">
              No alerts yet. Create one above — you'll get a notification the
              moment a matching listing goes live.
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="alerts-list">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 bg-zinc-50/60 hover:border-brand/30 transition"
                data-testid={`alert-row-${a.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-ink">
                      {a.crop}{" "}
                      <span className="text-ink-muted font-medium text-xs">
                        · {a.country}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      ≤ {fmtMoney(a.max_price_per_kg, currency)}/kg ·{" "}
                      {a.min_quantity_kg > 0
                        ? `min ${a.min_quantity_kg}kg`
                        : "any quantity"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.triggered_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Triggered {a.triggered_count}×
                    </span>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    className="af-btn-ghost text-red-600 hover:bg-red-50"
                    data-testid={`alert-delete-${a.id}`}
                    title="Delete alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
