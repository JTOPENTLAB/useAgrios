import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Clock, ShieldCheck, ArrowRight, Lock } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function LandingFeaturedOps() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api
      .get("/opportunities")
      .then((r) => {
        const opens = (r.data || []).filter((o) => o.status === "open");
        opens.sort((a, b) => {
          const pa = a.funding_target > 0 ? a.funding_raised / a.funding_target : 0;
          const pb = b.funding_target > 0 ? b.funding_raised / b.funding_target : 0;
          return pb - pa;
        });
        setRows(opens.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (rows.length === 0) return null;

  return (
    <section
      className="py-16 lg:py-24"
      id="featured-opps"
      data-testid="landing-featured-ops"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand">
              Open now
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mt-2 leading-tight">
              Cycles you can back today.
            </h2>
            <p className="text-ink-muted mt-2 max-w-xl">
              Each one is KYC-verified and escrow-protected. Most investors
              start with ₦50,000.
            </p>
          </div>
          <Link
            to="/signup?role=investor"
            className="af-btn-primary"
            data-testid="featured-ops-cta-main"
          >
            Start investing <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {rows.map((o) => {
            const pct =
              o.funding_target > 0
                ? Math.min(100, Math.round((o.funding_raised / o.funding_target) * 100))
                : 0;
            return (
              <Link
                key={o.id}
                to={`/signup?role=investor&next=${encodeURIComponent(`/app/opportunities/${o.id}`)}`}
                className="af-card af-card-hover p-5 flex flex-col gap-3"
                data-testid={`featured-op-${o.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand">
                    {o.crop} · {o.region}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                      RISK_CLS[o.risk_band] || RISK_CLS.B
                    }`}
                  >
                    Risk {o.risk_band}
                  </span>
                </div>
                <div className="font-heading font-bold text-ink text-lg line-clamp-2 min-h-[56px]">
                  {o.title}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading font-extrabold text-2xl text-ink">
                    {o.target_return_pct}%
                  </span>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {o.duration_months}mo target
                  </span>
                </div>
                <div>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand to-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-ink-muted">
                    <span>{pct}% funded</span>
                    <span>
                      {fmtMoney(o.funding_raised, o.currency)} /{" "}
                      {fmtMoney(o.funding_target, o.currency)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-2.5 h-2.5" /> KYC
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-brand/10 text-brand border border-brand/20">
                    <Lock className="w-2.5 h-2.5" /> Escrow
                  </span>
                  <span className="ml-auto text-xs text-brand font-bold flex items-center gap-1">
                    View <TrendingUp className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
