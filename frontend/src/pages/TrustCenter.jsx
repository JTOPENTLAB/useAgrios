import { Link } from "react-router-dom";
import {
  ShieldCheck,
  MapPin,
  Camera,
  FileText,
  CheckCircle2,
  Users,
  Landmark,
  Lock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const BADGES = [
  {
    id: "identity_verified",
    icon: ShieldCheck,
    title: "Identity verified",
    sub: "Government ID + selfie biometric check.",
    earn: "Farmer completes AGRIOS KYC flow and passes ID + face match.",
    remove: "Downgraded if ID expires or selfie re-check fails.",
  },
  {
    id: "farm_verified",
    icon: MapPin,
    title: "Farm verified",
    sub: "Geo-tagged farm location + on-site photos confirmed.",
    earn: "Farmer uploads geo-stamped photos; admin reviews against satellite.",
    remove: "Removed if farmer can't provide proof on a scheduled re-check.",
  },
  {
    id: "site_visit",
    icon: Camera,
    title: "Site visit completed",
    sub: "In-person AGRIOS site visit done within the last 90 days.",
    earn: "AGRIOS field operator logs geo-stamped photos + report.",
    remove: "Expires after 90 days without a refresh visit.",
  },
  {
    id: "offtake_signed",
    icon: FileText,
    title: "Offtake agreement signed",
    sub: "Buyer contract in place before cycle launches.",
    earn: "Upload of signed offtake MOU reviewed by compliance.",
    remove: "Removed if offtake buyer withdraws or contract expires.",
  },
  {
    id: "track_record",
    icon: Users,
    title: "Track record",
    sub: "≥3 completed cycles on AGRIOS with zero missed milestones.",
    earn: "Automatic — calculated from platform history.",
    remove: "Downgraded on any missed milestone or dispute.",
  },
  {
    id: "reporting_current",
    icon: CheckCircle2,
    title: "Reporting current",
    sub: "Farmer posted a progress update in the last 7 days.",
    earn: "Auto-enforced by platform update cadence.",
    remove: "Flag appears if >7 days silent. Investors are notified.",
  },
];

const GUARANTEES = [
  {
    icon: Lock,
    title: "Escrow on every disbursement",
    text: "Funds move in milestones. A farmer only unlocks the next tranche after the previous one is verified on-platform.",
  },
  {
    icon: Landmark,
    title: "Immutable transaction ledger",
    text: "Every kobo that enters or leaves AGRIOS is recorded in an append-only ledger. You can export a full statement at any time.",
  },
  {
    icon: AlertTriangle,
    title: "Honest risk framing",
    text: "We show you weather, market, execution, and reporting risk for every cycle. Target returns are targets — never guarantees.",
  },
];

export default function TrustCenter() {
  useDocumentMeta({
    title: "AGRIOS Trust Center — How we verify every opportunity",
    description:
      "AGRIOS Trust Center: verification methodology, risk framework, and the exact evidence behind every opportunity on the platform.",
  });

  return (
    <div
      className="min-h-screen bg-[#FAFAFA] text-ink"
      data-testid="trust-center-page"
    >
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
            <ShieldCheck className="w-3.5 h-3.5" /> Trust Center
          </span>
          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05]">
            How we verify every opportunity.
          </h1>
          <p className="mt-5 text-ink-muted text-lg leading-relaxed max-w-2xl mx-auto">
            AGRIOS is built on a single principle: no money moves without
            evidence. Here's exactly how verification, escrow, and risk
            framing work across the platform.
          </p>
        </div>
      </section>

      {/* Verification badges */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-brand">
              Verification framework
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl mt-2">
              Six trust badges. Earned, not assumed.
            </h2>
            <p className="text-ink-muted mt-3 max-w-2xl">
              Every farmer, farm, and opportunity on AGRIOS earns these
              independently. Each badge has explicit earn criteria and
              downgrade conditions — we don't hide the rules.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BADGES.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.id}
                  className="af-card p-6"
                  data-testid={`badge-${b.id}`}
                >
                  <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-bold text-ink">{b.title}</h3>
                  <p className="text-sm text-ink-muted mt-1">{b.sub}</p>
                  <div className="mt-4 space-y-2 text-xs pt-4 border-t border-zinc-100">
                    <div>
                      <span className="font-bold text-ink">How it's earned: </span>
                      <span className="text-ink-muted">{b.earn}</span>
                    </div>
                    <div>
                      <span className="font-bold text-ink">When it's removed: </span>
                      <span className="text-ink-muted">{b.remove}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core guarantees */}
      <section className="py-16 bg-white border-y border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-brand">
              Platform guarantees
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl mt-2">
              Three things always true on AGRIOS.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {GUARANTEES.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.title} className="af-card p-6">
                  <div className="w-11 h-11 rounded-xl bg-gold/15 text-gold-ink grid place-items-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-bold text-ink">
                    {g.title}
                  </h3>
                  <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                    {g.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Risk framing */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="af-card p-8 border-l-4 border-l-gold bg-gold/5">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-gold-ink flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-heading font-bold text-2xl text-ink">
                  Honest about what we can't guarantee.
                </h3>
                <p className="text-ink-soft mt-3 leading-relaxed">
                  Escrow protects how your money moves — it doesn't guarantee
                  agricultural returns. Weather, yields, and market prices can
                  all hurt a cycle. We show these risks for every opportunity
                  on its detail page. Target returns reflect the farmer's
                  best-case projection, not a promise.
                </p>
                <p className="text-ink-soft mt-3 leading-relaxed">
                  We take risk seriously because your trust is the only thing
                  that matters. If a cycle under-performs, we'll say so.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="af-card p-10 lg:p-14 text-center bg-gradient-to-br from-brand to-brand-dark text-white">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl">
              Now that you've seen behind the curtain.
            </h2>
            <p className="mt-4 text-white/80 max-w-xl mx-auto">
              Every opportunity on AGRIOS is held to the same standard. Start
              exploring verified, evidence-backed agricultural cycles.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/explore"
                className="af-btn-accent"
                data-testid="trust-cta-explore"
              >
                Explore opportunities <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border border-white/30 text-white hover:bg-white/10 transition"
                data-testid="trust-cta-signup"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-ink-muted">
          Built for global agricultural trade. Launching in Nigeria.
        </div>
      </footer>
    </div>
  );
}
