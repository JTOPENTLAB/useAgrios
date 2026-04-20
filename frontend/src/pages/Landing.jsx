import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Shield, Wallet, Truck, Sparkles, Star, CheckCircle2 } from "lucide-react";

const stats = [
  { v: "2.1M+", l: "KG facilitated (pilot)" },
  { v: "₦1.4B", l: "Escrow secured" },
  { v: "36", l: "Nigerian states reach" },
  { v: "< 24h", l: "Settlement window" },
];

const features = [
  {
    icon: Leaf,
    title: "Marketplace",
    text: "Farmers list produce, buyers discover supply — structured, priced, verified.",
  },
  {
    icon: Shield,
    title: "Escrow protection",
    text: "Every order is ring-fenced. Funds release only on delivery confirmation.",
  },
  {
    icon: Wallet,
    title: "Wallet & payouts",
    text: "Ledger-accurate balances, instant in-app settlement, fast payouts.",
  },
  {
    icon: Truck,
    title: "Logistics layer",
    text: "Auto-created jobs, transporter assignment, proof of delivery.",
  },
  {
    icon: Sparkles,
    title: "AI pricing & video",
    text: "Claude-powered fair price guidance and viral product video scripts.",
  },
  {
    icon: Star,
    title: "Trust engine",
    text: "Verified badges, ratings, reputation scoring built into every profile.",
  },
];

const HERO_IMG = "https://images.unsplash.com/photo-1596788068873-9ffd5cacd4c4?auto=format&fit=crop&w=1536&q=80";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-ink" data-testid="landing-page">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">A</div>
            <span className="font-heading font-extrabold text-xl tracking-tight">AgriFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
            <a href="#features" className="hover:text-ink">Platform</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#trust" className="hover:text-ink">Trust</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="af-btn-ghost" data-testid="nav-login-link">Log in</Link>
            <Link to="/signup" className="af-btn-primary" data-testid="nav-signup-link">
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10 lg:pt-24 lg:pb-20">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-7 af-stagger">
              <span className="af-badge-verified" data-testid="hero-badge">
                <CheckCircle2 className="w-3.5 h-3.5" /> Nigeria-first • Africa-ready
              </span>
              <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-ink">
                From Farm <span className="text-brand">to Money.</span>
                <br />
                <span className="text-ink-soft text-3xl sm:text-4xl lg:text-5xl font-bold">
                  Africa's agricultural financial infrastructure.
                </span>
              </h1>
              <p className="text-lg text-ink-muted max-w-xl leading-relaxed">
                AgriFlow is the trade + payments layer for African agriculture. Marketplace, escrow-protected
                orders, wallet, logistics, financing, and AI — all in one premium, mobile-first platform.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/signup" className="af-btn-primary" data-testid="hero-cta-primary">
                  Start selling / sourcing <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="af-btn-secondary" data-testid="hero-cta-secondary">
                  See a demo account
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {stats.map((s) => (
                  <div key={s.l} className="af-card p-4" data-testid={`stat-${s.l.replace(/\s/g, "-").toLowerCase()}`}>
                    <div className="font-heading font-extrabold text-2xl text-ink">{s.v}</div>
                    <div className="text-xs text-ink-muted mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-[2rem] overflow-hidden shadow-lift border border-zinc-100">
                <img src={HERO_IMG} alt="Nigerian farmer" className="w-full h-[520px] object-cover" />
                <div className="absolute bottom-4 left-4 right-4 af-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand grid place-items-center text-white font-bold">₦</div>
                  <div className="flex-1">
                    <div className="text-xs text-ink-muted">Escrow released</div>
                    <div className="font-heading font-bold">Tomato × 500kg — Ogun State</div>
                  </div>
                  <div className="af-badge-verified">Paid</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">The operating system</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-ink">
              Shopify + Stripe + Uber + TikTok — for agriculture.
            </h2>
            <p className="mt-4 text-ink-muted text-lg">
              Six tightly-integrated engines that turn scattered farm-to-market activity into structured,
              trustworthy, high-velocity trade.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 af-stagger">
            {features.map((f) => (
              <div key={f.title} className="af-card af-card-hover p-6" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-5">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-xl text-ink">{f.title}</h3>
                <p className="mt-2 text-ink-muted leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">How a deal flows</div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
                Escrow-first. Dispute-proof. Settlement in under 24h.
              </h2>
              <ol className="mt-8 space-y-5">
                {[
                  ["Farmer lists produce", "Crop, grade, quantity, price, location — structured and verifiable."],
                  ["Buyer funds escrow", "Wallet-backed payment. Funds locked in a dedicated escrow ledger."],
                  ["Logistics execute", "Job auto-created and accepted by a verified transporter. Proof-of-delivery uploaded."],
                  ["Release & payout", "Buyer confirms → farmer wallet credited minus platform commission."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-brand text-white grid place-items-center font-bold flex-shrink-0">{i + 1}</div>
                    <div>
                      <div className="font-heading font-bold text-ink">{t}</div>
                      <div className="text-ink-muted text-sm mt-1">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="af-card p-6 bg-gradient-to-br from-white to-zinc-50 border-l-4 border-l-gold">
              <div className="text-xs font-bold uppercase tracking-wider text-gold-dark mb-3">Live escrow</div>
              <div className="font-heading font-bold text-2xl mb-1">Order #AG-9241</div>
              <div className="text-ink-muted text-sm mb-6">Cassava × 2,000kg • Oyo → Lagos</div>
              <div className="flex justify-between items-center mb-4">
                {["Funded", "Picked up", "In transit", "Delivered"].map((s, i) => (
                  <div key={s} className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${i < 3 ? "bg-brand text-white" : "bg-zinc-200 text-ink-muted"}`}>
                      {i + 1}
                    </div>
                    <div className="text-[10px] mt-2 text-ink-muted text-center">{s}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-100 pt-4 flex justify-between text-sm">
                <span className="text-ink-muted">Escrow held</span>
                <span className="font-heading font-bold text-ink">₦700,000</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-ink-muted">Platform fee (5%)</span>
                <span className="font-bold text-ink">₦35,000</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-ink-muted">Farmer receives</span>
                <span className="font-bold text-brand">₦665,000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* This is for you if */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">This is for you if…</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">Built for the people who move African food.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 af-stagger">
            {[
              { who: "Farmers", says: "You grow the crop. We get you paid in 24h.", color: "bg-brand/5 border-brand/10" },
              { who: "Buyers", says: "Source verified supply with escrow protection.", color: "bg-gold/5 border-gold/20" },
              { who: "Transporters", says: "Steady pickups, clear payouts, better routes.", color: "bg-blue-50 border-blue-100" },
              { who: "Aggregators", says: "Move volume with structured trade tools.", color: "bg-zinc-50 border-zinc-100" },
            ].map((p) => (
              <div key={p.who} className={`rounded-2xl border p-6 ${p.color}`} data-testid={`persona-${p.who.toLowerCase()}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">You are a</div>
                <div className="font-heading font-extrabold text-2xl mt-1 text-ink">{p.who}</div>
                <div className="text-sm text-ink-soft mt-3 leading-relaxed">{p.says}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-3">The ground truth</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">What operators are saying.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 af-stagger">
            {[
              { q: "AgriFlow paid me in 12 hours. The market never pays me in 12 hours.", n: "Adebayo O.", r: "Farmer · Ogun" },
              { q: "We source 40 tons of cassava monthly now with zero payment disputes. Escrow is magic.", n: "Chioma O.", r: "Buyer · Lagos" },
              { q: "Clear pickups, clear routes, clear money. I've tripled my monthly income.", n: "Ibrahim T.", r: "Transporter · Lagos" },
            ].map((t) => (
              <div key={t.n} className="af-card p-6" data-testid={`testimonial-${t.n.replace(/\W/g, "")}`}>
                <div className="text-3xl text-brand leading-none">"</div>
                <p className="text-ink text-base leading-relaxed">{t.q}</p>
                <div className="mt-5 pt-5 border-t border-zinc-100">
                  <div className="font-heading font-bold text-ink">{t.n}</div>
                  <div className="text-xs text-ink-muted">{t.r}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="trust" className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="af-card p-10 lg:p-14 text-center bg-gradient-to-br from-brand to-brand-dark text-white">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl">
              Built for Nigeria. Designed for Africa.
            </h2>
            <p className="mt-4 text-white/80 max-w-2xl mx-auto text-lg">
              Join thousands of farmers, buyers, and logistics partners already moving money the AgriFlow way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup" className="af-btn-accent" data-testid="cta-signup">
                Create free account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border border-white/30 text-white hover:bg-white/10 transition">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand grid place-items-center text-white font-heading font-extrabold text-sm">A</div>
            <span className="font-heading font-bold text-ink">AgriFlow</span>
            <span className="ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div>From Farm to Money. 🇳🇬 Lagos · Abuja · Ibadan</div>
        </div>
      </footer>
    </div>
  );
}
