import { useEffect, useState } from "react";
import { Copy, Video, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function VideoScripts() {
  const [items, setItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { api.get("/video-templates").then((r) => setItems(r.data)); }, []);

  const copy = (t) => {
    const text = `${t.title}\n\nHOOK: ${t.hook}\n\nBEATS:\n${t.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedId(t.id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6" data-testid="video-scripts-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">Growth engine</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Viral video scripts</h1>
        <p className="text-ink-muted mt-1">20 proven short-form templates. Copy, shoot, post — or customise with AI.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 af-stagger">
        {items.map((t) => (
          <div key={t.id} className="af-card af-card-hover p-5 flex flex-col" data-testid={`video-template-${t.id}`}>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center"><Video className="w-5 h-5" /></div>
              <span className="af-chip text-[10px]">{t.id.toUpperCase()}</span>
            </div>
            <h3 className="font-heading font-bold text-lg mt-3 text-ink">{t.title}</h3>
            <div className="mt-3 text-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Hook</div>
              <div className="text-ink-soft italic">"{t.hook}"</div>
            </div>
            <div className="mt-3 text-sm flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">Beats</div>
              <ul className="space-y-1 text-ink-soft text-xs">
                {t.beats.map((b, i) => (
                  <li key={i} className="flex gap-2"><span className="text-brand font-bold">{i + 1}.</span> {b}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => copy(t)} className="af-btn-ghost mt-4 text-sm" data-testid={`copy-${t.id}`}>
              {copiedId === t.id ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy script</>}
            </button>
          </div>
        ))}
      </div>

      <div className="af-card p-6 bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-gold" />
          <div>
            <h3 className="font-heading font-bold text-xl">Want a custom one?</h3>
            <p className="text-white/80 text-sm mt-1">Use the AI Tools page to generate a personalised script for your exact listing.</p>
          </div>
          <a href="/app/farmer/ai" className="ml-auto af-btn-accent">AI script studio →</a>
        </div>
      </div>
    </div>
  );
}
