import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Sprout, Search, Eye, Lock } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const COUNTRY_FLAG = { NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", CI: "🇨🇮" };

export default function Explore() {
  useDocumentMeta({
    title: "Explore verified farm produce · AGRIOS",
    description:
      "Browse fresh, verified produce from farmers across Nigeria, Ghana, Kenya and Côte d'Ivoire. Escrow-protected. No middlemen. Sign up to place an order.",
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    api
      .get("/listings", { params })
      .then((r) => setItems((r.data || []).slice(0, 12)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-ink" data-testid="explore-page">
      {/* Header — mirrors landing for brand continuity */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="explore-brand-link">
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">
              A
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">AGRIOS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
            <Link to="/" className="hover:text-ink">Home</Link>
            <Link to="/explore" className="text-ink font-semibold">Explore</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="af-btn-ghost" data-testid="explore-login-link">Log in</Link>
            <Link to="/signup" className="af-btn-primary" data-testid="explore-signup-link">
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="flex flex-col gap-4 max-w-3xl">
          <span className="af-badge-verified w-fit" data-testid="explore-hero-badge">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified farmers · Escrow protected
          </span>
          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl leading-[1.05] text-ink">
            Explore Africa's <span className="text-brand">farm-fresh</span> supply.
          </h1>
          <p className="text-ink-muted text-lg max-w-xl">
            A live slice of produce listed by verified farmers across Nigeria, Ghana, Kenya and Côte
            d'Ivoire. Create a free buyer account to place escrow-protected orders.
          </p>

          <div className="af-card p-3 flex items-center gap-2 max-w-xl">
            <Search className="w-4 h-4 text-ink-muted ml-2" />
            <input
              className="af-input border-0 focus:ring-0 flex-1"
              placeholder="Search crop, variety, location…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              data-testid="explore-search-input"
            />
            <button onClick={load} className="af-btn-primary" data-testid="explore-search-btn">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Listings grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="af-card p-10 text-center text-ink-muted" data-testid="explore-loading">
            Loading fresh supply…
          </div>
        ) : items.length === 0 ? (
          <div className="af-card p-10 text-center" data-testid="explore-empty">
            <Sprout className="w-10 h-10 mx-auto text-ink-muted" />
            <div className="font-heading font-bold mt-3">No produce matches</div>
            <div className="text-sm text-ink-muted">Try a different search term.</div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-brand">Live supply</div>
                <h2 className="font-heading font-extrabold text-2xl text-ink">
                  {items.length} verified listings
                </h2>
              </div>
              <Link to="/signup?ref=explore" className="af-btn-accent" data-testid="explore-cta-top">
                Sign up to order <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
              {items.map((l) => {
                const currency = l.currency || "NGN";
                const flag = COUNTRY_FLAG[l.country_code] || "";
                return (
                  <Link
                    to="/signup?ref=explore"
                    key={l.id}
                    className="af-card af-card-hover overflow-hidden relative group"
                    data-testid={`explore-card-${l.id}`}
                  >
                    <div className="aspect-[4/3] bg-zinc-100 relative">
                      {l.image_url && (
                        <img
                          src={l.image_url}
                          alt={l.crop}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      )}
                      <span
                        className="absolute top-3 left-3 af-chip bg-white/95 text-[11px]"
                        data-testid={`explore-card-country-${l.id}`}
                      >
                        {flag} {l.country_code || "NG"}
                      </span>
                      {(l.views > 0) && (
                        <span className="absolute bottom-3 left-3 af-chip bg-white/95 text-[10px]">
                          <Eye className="w-3 h-3" /> {l.views}
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-heading font-bold text-lg text-ink">{l.crop}</h3>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {l.variety || "—"} · Grade {l.grade}
                          </div>
                        </div>
                        {l.farmer_verified && (
                          <span className="af-badge-verified">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                        <MapPin className="w-3.5 h-3.5" /> {l.location}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <div className="font-heading font-extrabold text-xl text-ink">
                            {fmtMoney(l.price_per_kg, currency)}
                            <span className="text-sm text-ink-muted font-normal">/kg</span>
                          </div>
                          <div className="text-xs text-ink-muted">
                            {Number(l.quantity_kg || 0).toLocaleString()}kg available
                          </div>
                        </div>
                        <span className="af-chip">
                          by {l.farmer_name?.split(" ")[0] || "Farmer"}
                        </span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-ink-muted">
                          <Lock className="w-3.5 h-3.5 text-brand" /> Sign up to place order
                        </span>
                        <span className="text-brand font-semibold inline-flex items-center gap-1">
                          Order <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div className="mt-12 af-card p-8 sm:p-10 bg-gradient-to-br from-brand/5 to-white border-brand/20 text-center" data-testid="explore-cta-bottom">
              <div className="text-xs font-bold uppercase tracking-wider text-brand">Get started free</div>
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl mt-2">
                Create a buyer account in 60 seconds.
              </h3>
              <p className="text-ink-muted mt-2 max-w-xl mx-auto">
                New buyers get a ₦5,000 wallet bonus. Every order is escrow-protected — funds release
                only when you confirm delivery.
              </p>
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                <Link to="/signup?ref=explore" className="af-btn-primary" data-testid="explore-cta-signup">
                  Sign up free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="af-btn-secondary" data-testid="explore-cta-login">
                  I already have an account
                </Link>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 mt-10">
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
            <Link to="/login" className="hover:text-ink">Log in</Link>
            <Link to="/signup" className="hover:text-ink">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
