import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, Eye, TrendingUp, Clock, ArrowRight } from "lucide-react";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import WalletFundModal from "@/components/WalletFundModal";
import PulseSignals from "@/components/PulseSignals";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function FirstInvestment() {
  const { user } = useAuth();
  const nav = useNavigate();
  const currency = user?.currency || "NGN";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWallet, setShowWallet] = useState(false);
  const [balance, setBalance] = useState(0);

  const refreshBalance = () =>
    api
      .get("/wallet")
      .then((r) => setBalance(Number(r.data?.wallet?.available || 0)))
      .catch(() => {});

  useEffect(() => {
    refreshBalance();
    api
      .get("/opportunities")
      .then((r) => {
        // Prioritize: open status, highest funded %, smallest min ticket first
        const list = (r.data || [])
          .filter((o) => o.status === "open")
          .sort((a, b) => {
            const pa = a.funding_target > 0 ? a.funding_raised / a.funding_target : 0;
            const pb = b.funding_target > 0 ? b.funding_raised / b.funding_target : 0;
            return pb - pa;
          });
        setRows(list.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const hasFunds = balance > 0;

  return (
    <div className="space-y-6" data-testid="first-investment-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <Sparkles className="w-3.5 h-3.5" /> Welcome to AGRIOS
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
            Start with your first allocation.
          </h1>
          <p className="text-ink-muted mt-2 max-w-xl">
            Most AGRIOS users begin with ₦50,000. Fund your wallet once, then
            deploy across any cycle in seconds.
          </p>
        </div>
        <div
          className="af-card p-4 bg-gradient-to-br from-brand to-brand-dark text-white min-w-[180px]"
          data-testid="first-invest-balance-card"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            Wallet balance
          </div>
          <div className="font-heading font-extrabold text-2xl mt-1">
            {fmtMoney(balance, currency)}
          </div>
        </div>
      </div>

      <PulseSignals />

      <div className="grid md:grid-cols-3 gap-3" data-testid="first-invest-opps">
        {loading ? (
          <div className="col-span-3 af-card p-10 text-center text-ink-muted">
            Loading verified cycles…
          </div>
        ) : rows.length === 0 ? (
          <div className="col-span-3 af-card p-10 text-center text-ink-muted">
            No open cycles at the moment. We'll notify you as soon as new ones
            launch.
          </div>
        ) : (
          rows.map((o) => <FeaturedCard key={o.id} o={o} />)
        )}
      </div>

      <div className="af-card p-6 bg-emerald-50/60 border-emerald-200 flex items-start gap-4 flex-wrap">
        <ShieldCheck className="w-6 h-6 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[200px]">
          <div className="font-heading font-bold text-ink">
            Every cycle is KYC-verified and escrow-protected.
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Funds only move when milestones are verified. You can always see
            where your money is going.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          data-testid="skip-to-dashboard"
        >
          Skip — go to my dashboard
        </Link>
        {hasFunds ? (
          <Link to="/app/opportunities" className="af-btn-primary" data-testid="explore-cta">
            Explore all opportunities <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowWallet(true)}
            className="af-btn-primary"
            data-testid="fund-wallet-cta"
          >
            Fund wallet to continue <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <WalletFundModal
        open={showWallet}
        onClose={() => setShowWallet(false)}
        onFunded={() => {
          refreshBalance();
          if (rows.length > 0) nav(`/app/opportunities/${rows[0].id}`);
        }}
        ctaLabel="Continue to first investment"
      />
    </div>
  );
}

function FeaturedCard({ o }) {
  const pct =
    o.funding_target > 0
      ? Math.min(100, Math.round((o.funding_raised / o.funding_target) * 100))
      : 0;
  const remaining = Math.max(0, (o.funding_target || 0) - (o.funding_raised || 0));
  return (
    <Link
      to={`/app/opportunities/${o.id}`}
      className="af-card af-card-hover p-5 flex flex-col gap-3"
      data-testid={`first-opp-${o.id}`}
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
      <div className="font-heading font-bold text-ink line-clamp-2 min-h-[48px]">
        {o.title}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading font-extrabold text-2xl text-ink">
          {o.target_return_pct}%
        </span>
        <span className="text-xs text-ink-muted">
          <Clock className="w-3 h-3 inline mr-1" />
          {o.duration_months}mo · min {fmtMoney(o.min_ticket, o.currency)}
        </span>
      </div>
      <div>
        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-brand to-emerald-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-ink-muted">
          <span>{pct}% funded</span>
          <span>{remaining > 0 ? `${fmtMoney(remaining, o.currency)} left` : "Full"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-2.5 h-2.5" /> KYC verified
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-brand/10 text-brand border border-brand/20">
          <Eye className="w-2.5 h-2.5" /> Escrow protected
        </span>
      </div>
      <div className="text-xs text-brand font-bold flex items-center gap-1">
        View opportunity <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}
