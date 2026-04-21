import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  MapPin,
  ShieldCheck,
  Sprout,
  Share2,
  Copy,
  CheckCircle2,
  Eye,
  Bookmark,
  Lock,
  Truck,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney, API_BASE } from "@/lib/api";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const COUNTRY_FLAG = { NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", CI: "🇨🇮" };
const COUNTRY_NAME = { NG: "Nigeria", GH: "Ghana", KE: "Kenya", CI: "Côte d'Ivoire" };

export default function PublicListing() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/listings/${id}`)
      .then((r) => {
        if (!cancelled) setListing(r.data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Dynamic per-listing document meta — fallbacks to generic while loading
  useDocumentMeta(
    listing
      ? {
          title: `${listing.crop} · ${fmtMoney(listing.price_per_kg, listing.currency || "NGN")}/kg · AGRIOS`,
          description: `${Number(listing.quantity_kg || 0).toLocaleString()}kg ${listing.crop} · Grade ${listing.grade} from ${listing.farmer_name || "verified farmer"} in ${listing.location}. Escrow-protected on AGRIOS — pay only when produce arrives.`,
        }
      : { title: "Listing · AGRIOS", description: "Shop verified farm produce with escrow protection on AGRIOS." }
  );

  if (notFound) return <Navigate to="/explore" replace />;

  const shareUrl = listing ? `${API_BASE}/p/${listing.id}` : "";

  const onShare = async () => {
    if (!shareUrl) return;
    const shareData = {
      title: `${listing.crop} on AGRIOS`,
      text: `Check out this ${listing.crop} on AGRIOS — escrow-protected, fresh from the farm.`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* user cancelled */
    }
    // Fallback: copy
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const currency = listing?.currency || "NGN";
  const flag = COUNTRY_FLAG[listing?.country_code] || "🇳🇬";
  const countryName = COUNTRY_NAME[listing?.country_code] || "Nigeria";

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-ink" data-testid="public-listing-page">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="listing-brand-link">
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">AGRIOS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
            <Link to="/" className="hover:text-ink">Home</Link>
            <Link to="/explore" className="hover:text-ink">Explore</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="af-btn-ghost" data-testid="listing-login-link">Log in</Link>
            <Link to="/signup" className="af-btn-primary" data-testid="listing-signup-link">
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink" data-testid="back-to-explore">
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>
      </div>

      {loading ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center text-ink-muted" data-testid="listing-loading">
          Loading listing…
        </div>
      ) : listing ? (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Image */}
            <div className="lg:col-span-3">
              <div className="af-card overflow-hidden">
                <div className="aspect-[4/3] bg-zinc-100 relative">
                  {listing.image_url ? (
                    <img
                      src={listing.image_url}
                      alt={listing.crop}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-ink-muted">
                      <Sprout className="w-12 h-12" />
                    </div>
                  )}
                  <span
                    className="absolute top-4 left-4 af-chip bg-white/95 text-xs"
                    data-testid="listing-country-chip"
                  >
                    {flag} {countryName}
                  </span>
                  {listing.farmer_verified && (
                    <span className="absolute top-4 right-4 af-badge-verified">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified farmer
                    </span>
                  )}
                </div>
              </div>

              {listing.description && (
                <div className="af-card p-6 mt-6" data-testid="listing-description">
                  <h2 className="font-heading font-bold text-lg mb-2">About this produce</h2>
                  <p className="text-ink-muted whitespace-pre-line leading-relaxed">
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Trust rail */}
              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                {[
                  { icon: Lock, t: "Escrow protected", d: "Funds only release on delivery." },
                  { icon: Truck, t: "Logistics handled", d: "Transporter auto-assigned." },
                  { icon: WalletIcon, t: "Wallet-native", d: "No cash, no middlemen." },
                ].map((b) => (
                  <div key={b.t} className="af-card p-4" data-testid={`trust-${b.t.toLowerCase().replace(/\s/g, "-")}`}>
                    <b.icon className="w-5 h-5 text-brand" />
                    <div className="font-bold text-sm mt-2">{b.t}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{b.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase panel */}
            <aside className="lg:col-span-2">
              <div className="af-card p-6 sticky top-24" data-testid="buy-panel">
                <div className="text-xs font-bold uppercase tracking-wider text-brand">
                  Grade {listing.grade}
                </div>
                <h1 className="font-heading font-extrabold text-3xl text-ink mt-1" data-testid="listing-crop-title">
                  {listing.crop}
                </h1>
                <div className="text-sm text-ink-muted mt-1">{listing.variety || "—"}</div>

                <div className="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="w-4 h-4" /> {listing.location}
                </div>

                <div className="mt-5 pb-5 border-b border-zinc-100">
                  <div className="font-heading font-extrabold text-4xl text-ink" data-testid="listing-price">
                    {fmtMoney(listing.price_per_kg, currency)}
                    <span className="text-base text-ink-muted font-normal">/kg</span>
                  </div>
                  <div className="text-sm text-ink-muted mt-1">
                    {Number(listing.quantity_kg || 0).toLocaleString()}kg available
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Farmer</span>
                    <span className="font-semibold text-ink">
                      {listing.farmer_name || "Verified farmer"}
                    </span>
                  </div>
                  {(listing.views > 0 || listing.saves > 0) && (
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Activity</span>
                      <span className="inline-flex items-center gap-3 text-ink">
                        {listing.views > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {listing.views}
                          </span>
                        )}
                        {listing.saves > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Bookmark className="w-3.5 h-3.5" /> {listing.saves}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  to={`/signup?ref=listing-${listing.id}`}
                  className="af-btn-primary w-full justify-center mt-6"
                  data-testid="cta-signup-to-buy"
                >
                  Sign up to place order <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to={`/login?next=/app/marketplace/${listing.id}`}
                  className="af-btn-secondary w-full justify-center mt-2"
                  data-testid="cta-login-to-buy"
                >
                  I already have an account
                </Link>

                <button
                  onClick={onShare}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink-soft hover:text-brand transition py-2"
                  data-testid="share-listing-btn"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-brand" /> Link copied
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" /> Share this listing
                    </>
                  )}
                </button>

                <div className="mt-5 pt-5 border-t border-zinc-100 flex items-start gap-2 text-xs text-ink-muted">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand" />
                  <span>
                    Your payment is held in escrow by AGRIOS and only released to the farmer once
                    you confirm delivery.
                  </span>
                </div>

                <div className="mt-4 af-chip bg-gold/10 border-gold/30 text-gold-dark w-full justify-center">
                  <Copy className="w-3 h-3" /> Share URL: <span className="font-mono text-[10px] truncate max-w-[140px]">{shareUrl.replace(/^https?:\/\//, "")}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {/* Footer */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand grid place-items-center text-white font-heading font-extrabold text-sm">
              A
            </div>
            <span className="font-heading font-bold text-ink">AGRIOS</span>
            <span>· Africa's agricultural financial infrastructure</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-ink">Home</Link>
            <Link to="/explore" className="hover:text-ink">Explore</Link>
            <Link to="/login" className="hover:text-ink">Log in</Link>
            <Link to="/signup" className="hover:text-ink">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
