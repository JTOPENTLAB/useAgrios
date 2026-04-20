import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Video, Wand2 } from "lucide-react";
import api from "@/lib/api";

export default function AiTools() {
  const [price, setPrice] = useState({ crop: "Tomato", region: "Ogun State", grade: "A", quantity_kg: 500 });
  const [priceOut, setPriceOut] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);

  const [video, setVideo] = useState({ crop: "Tomato", quantity_kg: 500, price_per_kg: 850, location: "Ogun State", grade: "A" });
  const [videoOut, setVideoOut] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);

  const runPrice = async (e) => {
    e.preventDefault();
    setPriceBusy(true);
    setPriceOut("");
    try {
      const { data } = await api.post("/ai/price-recommendation", price);
      setPriceOut(data.recommendation);
    } catch (err) {
      toast.error("AI unavailable");
    } finally {
      setPriceBusy(false);
    }
  };

  const runVideo = async (e) => {
    e.preventDefault();
    setVideoBusy(true);
    setVideoOut("");
    try {
      const { data } = await api.post("/ai/video-script", video);
      setVideoOut(data.script);
    } catch (err) {
      toast.error("AI unavailable");
    } finally {
      setVideoBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-tools-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">AI suite</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Sell smarter with AI</h1>
        <p className="text-ink-muted mt-1">Powered by Claude Sonnet 4.5 — tuned for African agri-trade.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={runPrice} className="af-card p-6 space-y-4" data-testid="ai-price-form">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center"><Wand2 className="w-5 h-5" /></div>
            <div>
              <div className="font-heading font-bold text-lg">Fair price recommendation</div>
              <div className="text-xs text-ink-muted">Crop + region + grade → suggested price range.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="af-input" value={price.crop} onChange={(e) => setPrice({ ...price, crop: e.target.value })} placeholder="Crop" data-testid="ai-p-crop" />
            <input className="af-input" value={price.region} onChange={(e) => setPrice({ ...price, region: e.target.value })} placeholder="Region" data-testid="ai-p-region" />
            <select className="af-input" value={price.grade} onChange={(e) => setPrice({ ...price, grade: e.target.value })}>
              <option>A</option><option>B</option><option>C</option>
            </select>
            <input type="number" className="af-input" value={price.quantity_kg} onChange={(e) => setPrice({ ...price, quantity_kg: +e.target.value })} placeholder="Qty kg" />
          </div>
          <button disabled={priceBusy} className="af-btn-primary w-full" data-testid="ai-p-run">
            <Sparkles className="w-4 h-4" /> {priceBusy ? "Analyzing…" : "Generate recommendation"}
          </button>
          {priceOut && <pre className="bg-zinc-50 rounded-xl p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed text-ink" data-testid="ai-p-out">{priceOut}</pre>}
        </form>

        <form onSubmit={runVideo} className="af-card p-6 space-y-4 border-l-4 border-l-gold" data-testid="ai-video-form">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center"><Video className="w-5 h-5" /></div>
            <div>
              <div className="font-heading font-bold text-lg">Viral video script</div>
              <div className="text-xs text-ink-muted">20-second short-form for TikTok / Reels / Shorts.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="af-input" value={video.crop} onChange={(e) => setVideo({ ...video, crop: e.target.value })} placeholder="Crop" data-testid="ai-v-crop" />
            <input className="af-input" value={video.location} onChange={(e) => setVideo({ ...video, location: e.target.value })} placeholder="Location" />
            <input type="number" className="af-input" value={video.quantity_kg} onChange={(e) => setVideo({ ...video, quantity_kg: +e.target.value })} placeholder="Qty kg" />
            <input type="number" className="af-input" value={video.price_per_kg} onChange={(e) => setVideo({ ...video, price_per_kg: +e.target.value })} placeholder="₦/kg" />
          </div>
          <button disabled={videoBusy} className="af-btn-accent w-full" data-testid="ai-v-run">
            <Sparkles className="w-4 h-4" /> {videoBusy ? "Writing…" : "Generate video script"}
          </button>
          {videoOut && <pre className="bg-zinc-50 rounded-xl p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed text-ink" data-testid="ai-v-out">{videoOut}</pre>}
        </form>
      </div>
    </div>
  );
}
