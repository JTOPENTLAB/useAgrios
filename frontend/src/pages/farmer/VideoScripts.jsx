import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Video, Sparkles, Check, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function VideoScripts() {
  const [items, setItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillCrop = searchParams.get("crop") || "";
  const prefillListing = searchParams.get("listing_id") || "";

  useEffect(() => {
    api.get("/video-templates").then((r) => setItems(r.data));
  }, []);

  const copy = (t) => {
    const hookText = prefillCrop
      ? t.hook.replace(/\[crop\]|\[produce\]|this produce/gi, prefillCrop)
      : t.hook;
    const text = `${t.title}${prefillCrop ? ` — for your ${prefillCrop}` : ""}\n\nHOOK: ${hookText}\n\nBEATS:\n${t.beats
      .map((b, i) => `${i + 1}. ${prefillCrop ? b.replace(/\[crop\]|\[produce\]/gi, prefillCrop) : b}`)
      .join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedId(t.id);
    toast.success(
      prefillCrop ? `Script copied for ${prefillCrop}` : "Copied to clipboard"
    );
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearPrefill = () => {
    searchParams.delete("crop");
    searchParams.delete("listing_id");
    setSearchParams(searchParams);
  };

  // Prioritize templates that mention the crop/topic in title or hook
  const orderedItems = useMemo(() => {
    if (!prefillCrop || items.length === 0) return items;
    const needle = prefillCrop.toLowerCase();
    const matches = (t) =>
      t.title.toLowerCase().includes(needle) ||
      t.hook.toLowerCase().includes(needle) ||
      (t.beats || []).some((b) => b.toLowerCase().includes(needle));
    return [...items].sort((a, b) => Number(matches(b)) - Number(matches(a)));
  }, [items, prefillCrop]);

  return (
    <div className="space-y-6" data-testid="video-scripts-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">
          Growth engine
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Viral video scripts</h1>
        <p className="text-ink-muted mt-1">
          20 proven short-form templates. Copy, shoot, post — or customise with AI.
        </p>
      </div>

      {/* Prefill banner */}
      {prefillCrop && (
        <div
          className="af-card p-5 bg-gradient-to-br from-gold/10 to-white border-l-4 border-l-gold flex items-center gap-4"
          data-testid="video-prefill-banner"
        >
          <div className="w-11 h-11 rounded-xl bg-gold/20 text-gold-dark grid place-items-center flex-shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold text-ink">
              Promoting: <span className="text-gold-dark">{prefillCrop}</span>
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              Scripts below are re-ordered to surface the best templates for your listing.
              Copies will auto-swap {`[crop]`} with "{prefillCrop}".
            </div>
          </div>
          {prefillListing && (
            <Link
              to="/app/farmer/listings"
              className="af-btn-ghost text-sm hidden sm:inline-flex"
              data-testid="back-to-listings"
            >
              <ArrowRight className="w-4 h-4" /> Back to listings
            </Link>
          )}
          <button
            onClick={clearPrefill}
            className="text-ink-muted hover:text-ink p-1"
            data-testid="clear-prefill-btn"
            aria-label="Clear pre-fill"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 af-stagger">
        {orderedItems.map((t) => (
          <div
            key={t.id}
            className="af-card af-card-hover p-5 flex flex-col"
            data-testid={`video-template-${t.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
                <Video className="w-5 h-5" />
              </div>
              <span className="af-chip text-[10px]">{t.id.toUpperCase()}</span>
            </div>
            <h3 className="font-heading font-bold text-lg mt-3 text-ink">
              {prefillCrop && (t.title.toLowerCase().includes(prefillCrop.toLowerCase()) || t.hook.toLowerCase().includes(prefillCrop.toLowerCase()))
                ? t.title
                : t.title}
            </h3>
            <div className="mt-3 text-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Hook</div>
              <div className="text-ink-soft italic">
                "{prefillCrop
                  ? t.hook.replace(/\[crop\]|\[produce\]/gi, prefillCrop)
                  : t.hook}"
              </div>
            </div>
            <div className="mt-3 text-sm flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                Beats
              </div>
              <ul className="space-y-1 text-ink-soft text-xs">
                {t.beats.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-brand font-bold">{i + 1}.</span>
                    {prefillCrop ? b.replace(/\[crop\]|\[produce\]/gi, prefillCrop) : b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => copy(t)}
              className="af-btn-ghost mt-4 text-sm"
              data-testid={`copy-${t.id}`}
            >
              {copiedId === t.id ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> {prefillCrop ? `Copy for ${prefillCrop}` : "Copy script"}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="af-card p-6 bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-gold" />
          <div>
            <h3 className="font-heading font-bold text-xl">Want a custom one?</h3>
            <p className="text-white/80 text-sm mt-1">
              Use the AI Tools page to generate a personalised script for your exact listing.
            </p>
          </div>
          <a
            href={`/app/farmer/ai${prefillCrop ? `?crop=${encodeURIComponent(prefillCrop)}` : ""}`}
            className="ml-auto af-btn-accent"
          >
            AI script studio →
          </a>
        </div>
      </div>
    </div>
  );
}
