import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Sparkles,
  Calendar,
  AlertCircle,
  Award,
  Sprout,
  Target,
  Coins,
  Crown,
  Wallet as WalletIcon,
  Layers,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import WalletFundModal from "@/components/WalletFundModal";

const BADGE_ICON = {
  seedling: Sprout,
  target: Target,
  trending: TrendingUp,
  coin: Coins,
  crown: Crown,
  wallet: WalletIcon,
  layers: Layers,
};

const STATUS_CLS = {
  active: "bg-brand/10 text-brand border-brand/20",
  matured: "bg-gold/10 text-gold-ink border-gold/30",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function MyInvestments() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const nav = useNavigate();

  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [feed, setFeed] = useState([]);
  const [milestones, setMilestones] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [reinvesting, setReinvesting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/investments/summary").then((r) => setSummary(r.data)),
      api.get("/investments/mine").then((r) => setRows(r.data || [])),
      api.get("/investments/mine/feed").then((r) => setFeed(r.data.items || [])),
      api.get("/investor/milestones").then((r) => setMilestones(r.data)),
      api.get("/wallet").then((r) => setBalance(Number(r.data?.wallet?.available || 0))),
    ]).finally(() => setLoading(false));
  }, []);

  const activeRows = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const paidRows = useMemo(() => rows.filter((r) => r.status === "paid"), [rows]);
  const capitalAtWork = summary
    ? (summary.total_invested || 0) -
      rows.filter((r) => r.status === "paid")
          .reduce((a, r) => a + Number(r.amount || 0), 0)
    : 0;

  const hasIdleFunds = balance >= 10000 && activeRows.length === 0;

  const oneClickReinvest = async (investment) => {
    setReinvesting(true);
    try {
      const { data } = await api.post(`/investments/${investment.id}/reinvest`, {
        amount: investment.amount,
      });
      nav(`/app/opportunities/${data.suggested_opportunity_id}?prefill=${data.suggested_amount}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Reinvest failed");
    } finally {
      setReinvesting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="my-investments-page">
      {/* Hero — "Your capital at work" */}
      <div className="af-card p-6 bg-gradient-to-br from-brand to-brand-dark text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-gold/15" />
        <div className="relative">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            Your capital at work
          </div>
          <div
            className="font-heading font-extrabold text-4xl sm:text-5xl mt-2"
            data-testid="capital-at-work"
          >
            {fmtMoney(capitalAtWork, currency)}
          </div>
          <div className="text-sm text-white/80 mt-1">
            across {activeRows.length} active cycle{activeRows.length === 1 ? "" : "s"}
            {summary && summary.realized_returns > 0 && (
              <span>
                {" · "}
                <strong className="text-gold">
                  +{fmtMoney(summary.realized_returns, currency)}
                </strong>{" "}
                realized so far
              </span>
            )}
          </div>
          <div className="mt-5 flex gap-2 flex-wrap">
            <Link
              to="/app/opportunities"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white text-brand font-semibold text-sm hover:bg-white/90"
              data-testid="hero-explore"
            >
              Browse new cycles <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setFundOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-white/25 text-white font-semibold text-sm hover:bg-white/10"
              data-testid="hero-top-up"
            >
              <WalletIcon className="w-3.5 h-3.5" /> Top up wallet
            </button>
          </div>
        </div>
      </div>

      {/* Idle funds banner */}
      {hasIdleFunds && (
        <div
          className="af-card p-5 bg-amber-50 border-amber-200 flex items-start gap-3"
          data-testid="idle-funds-banner"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-heading font-bold text-amber-900">
              Your funds are idle.
            </div>
            <p className="text-sm text-amber-800 mt-1">
              {fmtMoney(balance, currency)} sitting in your wallet. Put it to work
              on a verified cycle today.
            </p>
          </div>
          <Link
            to="/app/opportunities"
            className="af-btn-primary text-sm"
            data-testid="idle-cta"
          >
            Put capital to work
          </Link>
        </div>
      )}

      {/* Active investments + Feed in 2-col grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left — active investments */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading font-extrabold text-xl text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" /> Your active cycles
          </h2>
          {loading ? (
            <div className="af-card p-10 text-center text-ink-muted">Loading…</div>
          ) : activeRows.length === 0 && paidRows.length === 0 ? (
            <EmptyState onFund={() => setFundOpen(true)} />
          ) : (
            <>
              {activeRows.map((r) => (
                <ActiveInvestmentCard
                  key={r.id}
                  inv={r}
                  currency={currency}
                  onReinvest={() => oneClickReinvest(r)}
                  reinvesting={reinvesting}
                />
              ))}
              {/* Paid — reinvest prompts */}
              {paidRows.map((r) => (
                <PaidInvestmentCard
                  key={r.id}
                  inv={r}
                  currency={currency}
                  onReinvest={() => oneClickReinvest(r)}
                  reinvesting={reinvesting}
                />
              ))}
            </>
          )}
        </div>

        {/* Right — live feed + milestones */}
        <div className="space-y-4">
          {milestones && <MilestonesCard milestones={milestones} />}
          <LiveFeed feed={feed} />
        </div>
      </div>

      <WalletFundModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        onFunded={(n) => setBalance((b) => b + n)}
        ctaLabel="Continue"
      />
    </div>
  );
}

function ActiveInvestmentCard({ inv, currency, onReinvest, reinvesting }) {
  const opp = inv.opportunity || {};
  const createdAt = new Date(inv.created_at);
  const durationMs = (opp.duration_months || 6) * 30 * 86400000;
  const elapsed = Math.min(
    durationMs,
    Math.max(0, Date.now() - createdAt.getTime()),
  );
  const pct = Math.round((elapsed / durationMs) * 100);
  const maturity = new Date(createdAt.getTime() + durationMs);
  const daysToMaturity = Math.max(
    0,
    Math.ceil((maturity.getTime() - Date.now()) / 86400000),
  );
  const nextUpdateDays = Math.max(1, 7 - (Math.floor(elapsed / 86400000) % 7));

  return (
    <Link
      to={`/app/opportunities/${inv.opportunity_id}`}
      className="af-card p-5 block hover:border-brand/30 transition"
      data-testid={`active-inv-${inv.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-bold uppercase tracking-wider text-brand">
              {opp.crop || "—"} · {opp.region || "—"}
            </div>
            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${STATUS_CLS[inv.status] || STATUS_CLS.active}`}>
              {inv.status}
            </span>
          </div>
          <div className="font-heading font-bold text-ink mt-1">
            {opp.title || inv.opportunity_id}
          </div>
        </div>
        <div className="text-right">
          <div className="font-heading font-extrabold text-ink text-xl">
            {fmtMoney(inv.amount, currency)}
          </div>
          <div className="text-xs text-brand font-semibold">
            → {fmtMoney(inv.expected_payout, currency)}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-bold text-ink-muted uppercase tracking-wider">
            Cycle progress
          </span>
          <span className="font-heading font-bold text-ink">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
            data-testid={`progress-${inv.id}`}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-ink-muted flex-wrap gap-2">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Matures {fmtDate(maturity.toISOString())}{" "}
            · {daysToMaturity}d left
          </span>
          <span className="flex items-center gap-1">
            <Camera className="w-3 h-3" /> Next update in {nextUpdateDays}d
          </span>
        </div>
      </div>
      <div
        className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap"
        onClick={(e) => {
          if (e.target.closest("[data-stop]")) e.preventDefault();
        }}
      >
        <span className="text-xs text-ink-muted">
          Last update {daysToMaturity > 0 ? `${nextUpdateDays === 7 ? "just now" : `${7 - nextUpdateDays}d ago`}` : "—"}
        </span>
        <button
          type="button"
          data-stop
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReinvest();
          }}
          disabled={reinvesting}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark"
          data-testid={`reinvest-${inv.id}`}
        >
          <Repeat className="w-3.5 h-3.5" /> Reinvest in a similar cycle
        </button>
      </div>
    </Link>
  );
}

function PaidInvestmentCard({ inv, currency, onReinvest, reinvesting }) {
  const opp = inv.opportunity || {};
  const profit = (inv.realized_payout || inv.expected_payout || inv.amount) - inv.amount;
  return (
    <div
      className="af-card p-5 bg-emerald-50/60 border-emerald-200"
      data-testid={`paid-inv-${inv.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> Cycle completed · paid out
          </div>
          <div className="font-heading font-bold text-ink mt-1">
            {opp.title || inv.opportunity_id}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">
            {opp.crop || "—"} · {opp.region || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-heading font-extrabold text-emerald-700 text-xl">
            +{fmtMoney(profit, currency)}
          </div>
          <div className="text-xs text-ink-muted">
            on {fmtMoney(inv.amount, currency)}
          </div>
        </div>
      </div>
      <div className="mt-4 p-3 rounded-xl bg-white border border-emerald-100 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-ink-soft flex-1 min-w-[200px]">
          <strong className="text-ink">Your last cycle completed.</strong> Ready
          to allocate again? Similar cycles are open now.
        </div>
        <button
          type="button"
          onClick={onReinvest}
          disabled={reinvesting}
          className="af-btn-primary text-sm"
          data-testid={`paid-reinvest-${inv.id}`}
        >
          {reinvesting ? "Loading…" : "Reinvest now"}
        </button>
      </div>
    </div>
  );
}

function LiveFeed({ feed }) {
  if (!feed || feed.length === 0) {
    return (
      <div className="af-card p-5" data-testid="live-feed-empty">
        <h3 className="font-heading font-bold text-ink flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand" /> Farm updates
        </h3>
        <p className="text-sm text-ink-muted mt-2">
          Weekly updates from the cycles you've backed will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="af-card p-5" data-testid="live-feed">
      <h3 className="font-heading font-bold text-ink flex items-center gap-2">
        <Camera className="w-4 h-4 text-brand" /> Farm updates
      </h3>
      <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {feed.slice(0, 15).map((u, i) => (
          <div
            key={u.id || i}
            className="relative pl-6"
            data-testid={`feed-item-${i}`}
          >
            <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-brand ring-4 ring-brand/10" />
            {i < Math.min(feed.length, 15) - 1 && (
              <div className="absolute left-1.5 top-4 bottom-[-1rem] w-px bg-zinc-200" />
            )}
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              {fmtDate(u.created_at)} · {u.stage}
            </div>
            <div className="font-heading font-bold text-ink text-sm mt-0.5 line-clamp-1">
              {u.opportunity_title}
            </div>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed line-clamp-2">
              {u.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestonesCard({ milestones }) {
  return (
    <div className="af-card p-5" data-testid="milestones-card">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-gold-ink" />
        <h3 className="font-heading font-bold text-ink">Your milestones</h3>
        <span className="ml-auto text-[10px] font-bold uppercase text-brand">
          {milestones.earned_count}/{milestones.badges.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {milestones.badges.map((b) => {
          const Icon = BADGE_ICON[b.icon] || Award;
          return (
            <div
              key={b.id}
              className={`p-3 rounded-xl border text-xs ${
                b.earned
                  ? "bg-gold/10 border-gold/30"
                  : "bg-zinc-50 border-zinc-100 opacity-60"
              }`}
              data-testid={`badge-${b.id}`}
              title={b.rule}
            >
              <Icon
                className={`w-4 h-4 mb-1.5 ${
                  b.earned ? "text-gold-ink" : "text-ink-muted"
                }`}
              />
              <div className="font-heading font-bold text-ink text-[11px] leading-tight">
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onFund }) {
  return (
    <div className="af-card p-10 text-center" data-testid="my-inv-empty">
      <Sparkles className="w-10 h-10 text-brand mx-auto" />
      <h3 className="font-heading font-extrabold text-xl text-ink mt-3">
        No active cycles yet
      </h3>
      <p className="text-ink-muted mt-1 max-w-md mx-auto">
        Put your capital to work. Most investors start with ₦50,000 and scale
        up from there.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
        <Link to="/app/opportunities" className="af-btn-primary">
          Browse opportunities <ArrowRight className="w-4 h-4" />
        </Link>
        <button onClick={onFund} className="af-btn-ghost">
          <WalletIcon className="w-4 h-4" /> Fund wallet
        </button>
      </div>
    </div>
  );
}
