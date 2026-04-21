import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Sprout,
  ShoppingBag,
  TrendingUp,
  Lock,
  Truck,
  CheckCircle2,
  Wallet,
  Camera,
  FileText,
  Users,
} from "lucide-react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const TRACKS = {
  farmer: {
    title: "For farmers",
    icon: Sprout,
    tagline: "Sell produce. Raise funding. Build a track record.",
    steps: [
      {
        icon: FileText,
        title: "Get verified",
        text: "Complete KYC + farm verification. AGRIOS operators geo-tag your farm and issue trust badges.",
      },
      {
        icon: ShoppingBag,
        title: "List or raise",
        text: "List produce for buyers, or publish a funding opportunity for investors to back your cycle.",
      },
      {
        icon: Wallet,
        title: "Get paid safely",
        text: "Buyers fund escrow before goods ship. Investors' capital lands in your wallet in milestones.",
      },
      {
        icon: CheckCircle2,
        title: "Build your score",
        text: "Every completed cycle boosts your AGRIOS supplier score — unlocking larger orders and cheaper capital.",
      },
    ],
  },
  buyer: {
    title: "For buyers",
    icon: ShoppingBag,
    tagline: "Source verified produce. Pay via escrow. Reorder in one tap.",
    steps: [
      {
        icon: ShieldCheck,
        title: "Browse verified supply",
        text: "Every listing shows verified-farmer badges, trust score, live demand signals, and delivery ETA.",
      },
      {
        icon: Lock,
        title: "Pay into escrow",
        text: "Funds are held by AGRIOS until you confirm delivery. No farmer gets paid for undelivered goods.",
      },
      {
        icon: Truck,
        title: "Logistics handled",
        text: "We coordinate pickup, transit, and proof-of-delivery. Track your order in real time.",
      },
      {
        icon: CheckCircle2,
        title: "Reorder in one tap",
        text: "Completed orders can be cloned, re-priced at live market, and auto-funded from your wallet.",
      },
    ],
  },
  investor: {
    title: "For investors",
    icon: TrendingUp,
    tagline: "Back real farm cycles. Track milestones. Earn from the harvest.",
    steps: [
      {
        icon: Users,
        title: "Browse verified opportunities",
        text: "Each cycle has a risk band (A/B/C), use-of-funds breakdown, and an honest risk factors panel.",
      },
      {
        icon: Wallet,
        title: "Invest from your wallet",
        text: "Funds are debited to a milestone-protected escrow. The farmer unlocks tranches as cycle progresses.",
      },
      {
        icon: Camera,
        title: "See the farm",
        text: "Weekly geo-stamped updates. Verified milestones. If a farmer goes silent, you get notified.",
      },
      {
        icon: TrendingUp,
        title: "Earn at maturity",
        text: "On cycle completion, principal + return lands back in your AGRIOS wallet. Ready to re-deploy.",
      },
    ],
  },
};

export default function HowItWorks() {
  const [tab, setTab] = useState("investor");
  useDocumentMeta({
    title: "How AGRIOS works — Farmers, Buyers, Investors",
    description:
      "See exactly how AGRIOS moves money, produce, and capital — from verified listings to escrow-protected payouts and investor-backed farm cycles.",
  });

  const t = TRACKS[tab];
  const Icon = t.icon;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-ink" data-testid="how-it-works-page">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">
              AGRIOS
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/15 rounded-full px-3 py-1.5">
            How AGRIOS works
          </span>
          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05]">
            One platform. Three sides. Zero surprises.
          </h1>
          <p className="mt-5 text-ink-muted text-lg leading-relaxed max-w-2xl mx-auto">
            AGRIOS connects farmers, buyers, and investors on a single rails
            system — with escrow, verification, and honest risk framing baked in.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="flex items-center justify-center gap-2 mb-10 flex-wrap"
            data-testid="how-tabs"
          >
            {Object.entries(TRACKS).map(([key, cfg]) => {
              const TIcon = cfg.icon;
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold border transition ${
                    active
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
                  }`}
                  data-testid={`how-tab-${key}`}
                >
                  <TIcon className="w-4 h-4" />
                  {cfg.title}
                </button>
              );
            })}
          </div>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-brand mb-4">
              <Icon className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {t.title}
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl">
              {t.tagline}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.steps.map((s, i) => {
              const SIcon = s.icon;
              return (
                <div
                  key={i}
                  className="af-card p-6 relative"
                  data-testid={`how-step-${i}`}
                >
                  <div className="absolute top-4 right-4 text-xs font-bold text-ink-muted">
                    0{i + 1}
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4">
                    <SIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-bold text-ink">{s.title}</h3>
                  <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                    {s.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-12 bg-white border-y border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Lock,
                title: "Escrow on every transaction",
                text: "Money only moves after delivery or milestone verification.",
              },
              {
                icon: ShieldCheck,
                title: "Verified by operators",
                text: "Farmers pass KYC + on-site inspection before going live.",
              },
              {
                icon: FileText,
                title: "Immutable ledger",
                text: "Every kobo in and out is tracked. Export at any time.",
              },
            ].map((g) => {
              const GIcon = g.icon;
              return (
                <div key={g.title} className="af-card p-5">
                  <div className="w-11 h-11 rounded-xl bg-gold/15 text-gold-ink grid place-items-center mb-3">
                    <GIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-bold text-ink">{g.title}</h3>
                  <p className="text-sm text-ink-muted mt-1.5">{g.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="af-card p-10 lg:p-14 text-center bg-gradient-to-br from-brand to-brand-dark text-white">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl">
              Ready to join AGRIOS?
            </h2>
            <p className="mt-4 text-white/80 max-w-xl mx-auto">
              Whether you grow it, buy it, or back it — start in under two minutes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="af-btn-accent"
                data-testid="how-cta-signup"
              >
                Create an account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/trust"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border border-white/30 text-white hover:bg-white/10 transition"
                data-testid="how-cta-trust"
              >
                See how we verify
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-ink-muted">
          Built for global agricultural trade. Launching in Nigeria.
        </div>
      </footer>
    </div>
  );
}
