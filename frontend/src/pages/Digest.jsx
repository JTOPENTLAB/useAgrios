import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  Mail,
  MessageSquare,
  Send,
  Copy,
  Check,
  Flame,
  TrendingUp,
  Crown,
  Sprout,
  ArrowRight,
  Settings as SettingsIcon,
} from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Digest() {
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [waUrl, setWaUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/digest/preview").then((r) => setPreview(r.data)),
      api.get("/digest/prefs").then((r) => setPrefs(r.data)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const savePrefs = async (next) => {
    try {
      const { data } = await api.put("/digest/prefs", next);
      setPrefs(data);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/digest/send-me-now");
      setWaUrl(data.whatsapp_url);
      toast.success(
        data.dispatch.provider === "mock"
          ? "Digest logged (mock mode — connect Resend to send real emails)"
          : "Sent to your inbox"
      );
    } catch {
      toast.error("Failed");
    } finally {
      setBusy(false);
    }
  };

  const copyWhatsApp = async () => {
    if (!preview?.whatsapp_text) return;
    try {
      await navigator.clipboard.writeText(preview.whatsapp_text);
      setCopied(true);
      toast.success("Copied — paste anywhere");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const openWa = () => {
    if (!preview?.whatsapp_text) return;
    const url = `https://wa.me/?text=${encodeURIComponent(preview.whatsapp_text)}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-6" data-testid="digest-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Growth engine
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            AGRIOS Market Pulse
          </h1>
          <p className="text-ink-muted mt-1">
            Your weekly briefing — delivered every Monday 9am WAT.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendTest}
            disabled={busy}
            className="af-btn-primary"
            data-testid="digest-send-test"
          >
            <Send className="w-4 h-4" /> {busy ? "Sending…" : "Send me a test"}
          </button>
        </div>
      </div>

      {/* Preferences */}
      <section className="af-card p-6" data-testid="digest-prefs-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink">Delivery preferences</h3>
            <div className="text-xs text-ink-muted">
              You're signed up as {user?.email}. Opt-out anytime.
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => savePrefs({ ...prefs, email: !prefs?.email })}
            className={`text-left rounded-2xl p-4 border transition ${
              prefs?.email
                ? "border-brand bg-brand/5"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
            data-testid="prefs-email-toggle"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl grid place-items-center ${
                  prefs?.email
                    ? "bg-brand text-white"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-ink text-sm">
                  Email digest
                </div>
                <div className="text-xs text-ink-muted">
                  {prefs?.email ? "Enabled" : "Disabled"} · {prefs?.frequency || "weekly"}
                </div>
              </div>
              <span
                className={`w-10 h-6 rounded-full p-0.5 transition ${
                  prefs?.email ? "bg-brand" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition ${
                    prefs?.email ? "translate-x-4" : ""
                  }`}
                />
              </span>
            </div>
          </button>

          <div
            className="rounded-2xl p-4 border border-zinc-200 bg-zinc-50"
            data-testid="prefs-whatsapp-info"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-ink text-sm">WhatsApp share</div>
                <div className="text-xs text-ink-muted">
                  Share to any chat — one tap, no approvals.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="af-card overflow-hidden" data-testid="digest-preview-card">
        <div className="p-6 pb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-ink">Next Monday's pulse — preview</h3>
              <div className="text-xs text-ink-muted">
                Personalised for you based on last 30 days of market activity.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openWa}
              className="af-btn-accent text-sm"
              disabled={!preview}
              data-testid="digest-share-whatsapp"
            >
              <MessageSquare className="w-4 h-4" /> Share via WhatsApp
            </button>
            <button
              onClick={copyWhatsApp}
              className="af-btn-ghost text-sm"
              disabled={!preview}
              data-testid="digest-copy-whatsapp"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy text
                </>
              )}
            </button>
          </div>
        </div>

        {loading || !preview ? (
          <div className="p-10 text-center text-ink-muted">Composing your digest…</div>
        ) : (
          <div className="px-6 pb-6 space-y-6">
            {/* Headline */}
            <div className="rounded-2xl bg-gradient-to-br from-brand/5 to-white p-5 border border-brand/15">
              <div className="text-xs font-bold uppercase tracking-wider text-brand">
                {preview.period.label}
              </div>
              <div
                className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mt-1 leading-tight"
                data-testid="digest-headline"
              >
                {preview.headline}
              </div>
              <Link
                to={preview.cta_url.replace(/^https?:\/\/[^/]+/, "") || "/app"}
                className="af-btn-primary mt-4 inline-flex"
                data-testid="digest-primary-cta"
              >
                {preview.cta_text} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Hot demand */}
            {preview.hot_crops?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-rose-600" />
                  <h4 className="font-heading font-bold text-ink">Hot this week</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-3" data-testid="digest-hot-crops">
                  {preview.hot_crops.slice(0, 4).map((h) => (
                    <div
                      key={h.crop}
                      className="rounded-2xl border border-zinc-100 p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-ink">{h.crop}</div>
                        <div className="text-[11px] text-ink-muted font-semibold">
                          {h.price_min && h.price_max
                            ? `${fmtMoney(h.price_min, h.currency)}–${fmtMoney(h.price_max, h.currency)}/kg`
                            : `${h.available_listings} listing(s)`}
                        </div>
                      </div>
                      <span
                        className={`af-chip text-[11px] font-bold ${
                          h.pct_change == null
                            ? ""
                            : h.pct_change > 0
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : "text-brand"
                        }`}
                      >
                        {h.pct_change == null
                          ? "new"
                          : `${h.pct_change > 0 ? "+" : ""}${h.pct_change}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suppliers OR price guidance */}
            {preview.suppliers?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-gold-dark" />
                  <h4 className="font-heading font-bold text-ink">Featured verified suppliers</h4>
                </div>
                <div className="space-y-2" data-testid="digest-suppliers">
                  {preview.suppliers.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-zinc-100 p-3 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand/10 text-brand grid place-items-center font-heading font-extrabold flex-shrink-0">
                        {s.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-ink text-sm truncate">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {s.location} · {s.completed_orders} completed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-brand text-sm">{s.latest_crop}</div>
                        <div className="text-[11px] text-ink-muted">
                          {fmtMoney(s.latest_price, s.latest_currency)}/kg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.price_guidance?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  <h4 className="font-heading font-bold text-ink">Your price vs market</h4>
                </div>
                <div className="space-y-2" data-testid="digest-price-guidance">
                  {preview.price_guidance.map((g) => (
                    <div
                      key={g.crop}
                      className="rounded-xl border border-zinc-100 p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-ink text-sm">{g.crop}</div>
                        <div className="text-[11px] text-ink-muted">
                          You: {fmtMoney(g.your_price, g.currency)} · Median{" "}
                          {fmtMoney(g.market_median, g.currency)} · P75{" "}
                          {fmtMoney(g.market_p75, g.currency)}
                        </div>
                      </div>
                      <span
                        className={`af-chip text-[11px] font-bold ${
                          g.suggestion === "raise"
                            ? "text-brand bg-brand/5 border-brand/30"
                            : g.suggestion === "lower"
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : ""
                        }`}
                      >
                        {g.suggestion === "raise"
                          ? "Raise"
                          : g.suggestion === "lower"
                          ? "Above market"
                          : "Fair"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.suggest_crops?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sprout className="w-4 h-4 text-brand" />
                  <h4 className="font-heading font-bold text-ink">
                    Hot crops you're not listing yet
                  </h4>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {preview.suggest_crops.map((s) => (
                    <Link
                      key={s.crop}
                      to="/app/farmer/listings/new"
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100"
                    >
                      🔥 {s.crop}
                      {s.pct_change != null && (
                        <span className="opacity-70">+{s.pct_change}%</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp text preview */}
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4" data-testid="digest-wa-preview">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                WhatsApp share text
              </div>
              <pre className="text-xs text-ink-soft whitespace-pre-wrap font-mono leading-relaxed">
                {preview.whatsapp_text}
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* Mock-mode notice */}
      <div className="af-card p-5 border-l-4 border-l-gold bg-gradient-to-br from-gold/5 to-white" data-testid="mock-mode-notice">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark grid place-items-center flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="text-sm">
            <div className="font-heading font-bold text-ink">
              Email delivery is in simulation mode
            </div>
            <div className="text-ink-muted mt-1">
              Digests are composed, logged to <code className="text-[11px]">digest_log</code>{" "}
              and available via the share link. Set{" "}
              <code className="text-[11px]">RESEND_API_KEY</code> in the backend to flip on
              real email sending — no code changes required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
