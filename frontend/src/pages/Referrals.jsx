import { useEffect, useState } from "react";
import {
  Users,
  Gift,
  Copy,
  Check,
  TrendingUp,
  CheckCircle2,
  Clock,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Referrals() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/referrals/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const copy = async () => {
    if (!stats?.link) return;
    try {
      await navigator.clipboard.writeText(stats.link);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — try long-pressing the link.");
    }
  };

  const shareText = stats
    ? `I'm earning on verified Nigerian farm cycles with AGRIOS. Use my link and we both get ₦${(
        stats.bonus_per_referral || 2000
      ).toLocaleString()} after your first investment: ${stats.link}`
    : "";

  const nativeShare = async () => {
    if (!stats) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on AGRIOS",
          text: shareText,
        });
      } catch {
        // user dismissed
      }
    } else {
      copy();
    }
  };

  return (
    <div className="space-y-6" data-testid="referrals-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Invite & earn
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
          Earn ₦{(stats?.bonus_per_referral || 2000).toLocaleString()} for every friend
          who invests.
        </h1>
        <p className="text-ink-muted mt-2 max-w-xl">
          Share your personal link. When a friend signs up and makes their first
          investment, you both get a ₦
          {(stats?.bonus_per_referral || 2000).toLocaleString()} wallet bonus —
          instantly.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi
          icon={Users}
          label="Invited"
          value={stats?.invited_count ?? "—"}
          testId="ref-kpi-invited"
        />
        <Kpi
          icon={CheckCircle2}
          label="Activated"
          value={stats?.activated_count ?? "—"}
          sub={
            stats
              ? `${
                  stats.invited_count > 0
                    ? Math.round(
                        (stats.activated_count / stats.invited_count) * 100,
                      )
                    : 0
                }% conversion`
              : ""
          }
          tone="brand"
          testId="ref-kpi-activated"
        />
        <Kpi
          icon={TrendingUp}
          label="Earned"
          value={stats ? fmtMoney(stats.total_earned, currency) : "—"}
          tone="gold"
          testId="ref-kpi-earned"
        />
      </div>

      {/* Share card */}
      <div className="af-card p-6 sm:p-7" data-testid="ref-share-card">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
          <Gift className="w-3.5 h-3.5" /> Your referral link
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div
            className="flex-1 min-w-[260px] font-mono text-sm bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 overflow-x-auto whitespace-nowrap"
            data-testid="ref-link-box"
          >
            {stats?.link || "Loading…"}
          </div>
          <button
            onClick={copy}
            className="af-btn-primary text-sm"
            data-testid="ref-copy-btn"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy link
              </>
            )}
          </button>
        </div>
        <div className="text-[11px] text-ink-muted mt-2">
          Code:{" "}
          <strong className="font-mono text-ink">
            {stats?.code || "—"}
          </strong>{" "}
          · anyone using this on signup triggers the reward.
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap" data-testid="ref-social">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#25D366] text-white hover:opacity-90"
            data-testid="ref-share-whatsapp"
          >
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-ink text-white hover:bg-ink/90"
            data-testid="ref-share-twitter"
          >
            Twitter / X
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(stats?.link || "")}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#2AABEE] text-white hover:opacity-90"
            data-testid="ref-share-telegram"
          >
            Telegram
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(stats?.link || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#0A66C2] text-white hover:opacity-90"
            data-testid="ref-share-linkedin"
          >
            LinkedIn
          </a>
          <button
            onClick={nativeShare}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-zinc-200 text-ink-soft hover:border-zinc-300"
            data-testid="ref-share-native"
          >
            <Share2 className="w-4 h-4" /> More
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="af-card p-6 grid sm:grid-cols-3 gap-4" data-testid="ref-how-it-works">
        <HowStep
          n={1}
          title="Share your link"
          text="Post it on WhatsApp, Twitter, LinkedIn — anywhere your friends are."
        />
        <HowStep
          n={2}
          title="They sign up & invest"
          text="Friend creates an account with your link and makes their first investment."
        />
        <HowStep
          n={3}
          title="Both get ₦2,000"
          text="Wallet bonus credits to both of you, instantly. Redeemable immediately."
        />
      </div>

      {/* Recent invites */}
      {stats && stats.recent && stats.recent.length > 0 && (
        <div className="af-card p-6" data-testid="ref-recent">
          <h3 className="font-heading font-bold text-ink mb-3">Your invites</h3>
          <div className="space-y-2">
            {stats.recent.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                data-testid={`ref-invite-${i}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-brand/10 text-brand grid place-items-center font-heading font-bold">
                    {r.initial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-ink text-sm truncate">
                      {r.name_masked}
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {r.joined_at
                        ? new Date(r.joined_at).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                    r.activated
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-zinc-100 text-ink-muted border-zinc-200"
                  }`}
                >
                  {r.activated ? "Activated · paid out" : "Pending invest"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, testId }) {
  const toneCls =
    tone === "brand"
      ? "bg-gradient-to-br from-brand to-brand-dark text-white border-0"
      : tone === "gold"
      ? "bg-gradient-to-br from-gold/90 to-amber-500 text-white border-0"
      : "bg-white text-ink";
  return (
    <div className={`af-card p-5 ${toneCls}`} data-testid={testId}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="font-heading font-extrabold text-2xl mt-1.5">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function HowStep({ n, title, text }) {
  return (
    <div>
      <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center font-heading font-extrabold">
        {n}
      </div>
      <h4 className="font-heading font-bold text-ink mt-3">{title}</h4>
      <p className="text-sm text-ink-muted mt-1">{text}</p>
    </div>
  );
}
