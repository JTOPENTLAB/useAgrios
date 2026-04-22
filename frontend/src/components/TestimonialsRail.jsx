import { Quote, Sprout, TrendingUp, ShoppingBag } from "lucide-react";

const QUOTES = [
  {
    id: "q1",
    role: "farmer",
    icon: Sprout,
    roleLabel: "Tomato farmer · Ogun",
    name: "Bola Adewale",
    quote:
      "Before AGRIOS, buyers would delay payment for weeks. Now escrow releases the same day the truck delivers. I've doubled my weekly cycles.",
    metric: "12 cycles completed",
  },
  {
    id: "q2",
    role: "investor",
    icon: TrendingUp,
    roleLabel: "Investor · Lagos",
    name: "Tunde Adesanya",
    quote:
      "I wanted real exposure to Nigerian agriculture without the guesswork. AGRIOS shows me the farm, the risk band, and weekly updates. My first cycle paid out 14% at maturity.",
    metric: "₦1.25M deployed · 14% avg return",
  },
  {
    id: "q3",
    role: "buyer",
    icon: ShoppingBag,
    roleLabel: "Restaurant supply · Abuja",
    name: "Ngozi Okafor",
    quote:
      "One-click reorder is the game changer. My top 5 suppliers are on AGRIOS and I can refill a standing order in 30 seconds. Logistics is coordinated for me.",
    metric: "48 orders · ₦6.2M spend",
  },
  {
    id: "q4",
    role: "farmer",
    icon: Sprout,
    roleLabel: "Cassava farmer · Oyo",
    name: "Segun Ibrahim",
    quote:
      "The investor marketplace helped me fund my 20-hectare expansion. I'd never have gotten a bank loan — AGRIOS investors looked at my track record and backed me.",
    metric: "₦3.4M cycle funded in 9 days",
  },
];

const ROLE_CLS = {
  farmer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  investor: "bg-gold/15 text-gold-ink border-gold/30",
  buyer: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function TestimonialsRail() {
  return (
    <section className="py-16 lg:py-24 bg-[#F6F7F3]" data-testid="testimonials-rail">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Voices from the platform
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mt-2 leading-tight">
            Real farmers. Real buyers. Real investors.
          </h2>
          <p className="text-ink-muted mt-3">
            Four sides of the AGRIOS loop, in their own words.
          </p>
        </div>
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {QUOTES.map((q) => {
            const Icon = q.icon;
            return (
              <figure
                key={q.id}
                className="af-card p-6 sm:p-7 relative"
                data-testid={`testimonial-${q.id}`}
              >
                <Quote className="absolute top-6 right-6 w-10 h-10 text-brand/10" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                      ROLE_CLS[q.role] || ROLE_CLS.farmer
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {q.roleLabel}
                  </span>
                </div>
                <blockquote className="mt-4 text-ink text-lg leading-relaxed">
                  "{q.quote}"
                </blockquote>
                <figcaption className="mt-6 pt-4 border-t border-zinc-100 flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-heading font-bold text-ink">
                      {q.name}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Verified AGRIOS user
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand">
                      Track record
                    </div>
                    <div className="text-sm font-heading font-bold text-ink">
                      {q.metric}
                    </div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
