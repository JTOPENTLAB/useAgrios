import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import api from "@/lib/api";

const GRADES = ["A", "B", "C"];
const SAMPLE_IMG = "https://images.pexels.com/photos/13711819/pexels-photo-13711819.jpeg?auto=compress&cs=tinysrgb&w=800";

export default function NewListing() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [priceTip, setPriceTip] = useState(null);
  const [form, setForm] = useState({
    crop: "",
    variety: "",
    quantity_kg: 100,
    price_per_kg: 0,
    grade: "A",
    location: "",
    description: "",
    image_url: SAMPLE_IMG,
  });
  const upd = (k) => (e) => {
    const v = ["quantity_kg", "price_per_kg"].includes(k) ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Use absolute URL so <img> can load directly
      setForm((f) => ({ ...f, image_url: `${API_BASE.replace(/\/api$/, "")}${data.url}` }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const aiPrice = async () => {
    if (!form.crop || !form.location) {
      toast.error("Enter crop and location first");
      return;
    }
    setPriceTip("Thinking…");
    try {
      const { data } = await api.post("/ai/price-recommendation", {
        crop: form.crop,
        region: form.location,
        grade: form.grade,
        quantity_kg: form.quantity_kg,
      });
      setPriceTip(data.recommendation);
    } catch (e) {
      setPriceTip(null);
      toast.error("AI unavailable. Try again.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/listings", form);
      toast.success("Listing published!");
      nav("/app/farmer/listings");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="new-listing-page">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">List new produce</h1>
        <p className="text-ink-muted mt-1">Show buyers what you have — freshly harvested.</p>
      </div>

      <form onSubmit={submit} className="grid lg:grid-cols-3 gap-6">
        <div className="af-card p-6 lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Crop name" required>
              <input className="af-input" required value={form.crop} onChange={upd("crop")} placeholder="e.g. Tomato" data-testid="crop-input" />
            </Field>
            <Field label="Variety">
              <input className="af-input" value={form.variety} onChange={upd("variety")} placeholder="e.g. Roma" data-testid="variety-input" />
            </Field>
            <Field label="Quantity (kg)" required>
              <input type="number" min={1} className="af-input" required value={form.quantity_kg} onChange={upd("quantity_kg")} data-testid="quantity-input" />
            </Field>
            <Field label="Price per kg (₦)" required>
              <input type="number" min={0} className="af-input" required value={form.price_per_kg} onChange={upd("price_per_kg")} data-testid="price-input" />
            </Field>
            <Field label="Grade">
              <select className="af-input" value={form.grade} onChange={upd("grade")} data-testid="grade-select">
                {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </Field>
            <Field label="Location / State" required>
              <input className="af-input" required value={form.location} onChange={upd("location")} placeholder="e.g. Ogun State" data-testid="location-input" />
            </Field>
          </div>
          <Field label="Description">
            <textarea className="af-input min-h-[100px]" value={form.description} onChange={upd("description")} placeholder="Quality notes, harvest time, pickup details…" data-testid="description-input" />
          </Field>
          <Field label="Image URL">
            <div className="flex gap-2">
              <input className="af-input flex-1" value={form.image_url} onChange={upd("image_url")} data-testid="image-input" />
              <label className={`af-btn-secondary cursor-pointer !py-3 ${uploading ? "opacity-50 pointer-events-none" : ""}`} data-testid="upload-btn">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                {uploading ? "Uploading" : "Upload"}
              </label>
            </div>
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy} className="af-btn-primary" data-testid="publish-btn">
              {busy ? "Publishing…" : "Publish listing"}
            </button>
            <button type="button" onClick={() => nav(-1)} className="af-btn-ghost">Cancel</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="af-card p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-2">Preview</div>
            <div className="aspect-[4/3] bg-zinc-100 rounded-xl overflow-hidden">
              {form.image_url && <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />}
            </div>
            <div className="mt-3 font-heading font-bold text-ink">{form.crop || "Your crop"}</div>
            <div className="text-xs text-ink-muted">{form.location || "Location"} · Grade {form.grade}</div>
            <div className="mt-2 font-heading font-extrabold text-xl text-brand">₦{(form.price_per_kg || 0).toLocaleString()}/kg</div>
          </div>
          <div className="af-card p-5 border-l-4 border-l-gold">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gold-dark">AI pricing</span>
              <Sparkles className="w-4 h-4 text-gold-dark" />
            </div>
            <button type="button" onClick={aiPrice} className="af-btn-accent w-full" data-testid="ai-price-btn">
              Suggest fair price
            </button>
            {priceTip && (
              <pre className="mt-3 text-xs text-ink-soft whitespace-pre-wrap font-sans leading-relaxed" data-testid="ai-price-result">{priceTip}</pre>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-ink-soft mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
