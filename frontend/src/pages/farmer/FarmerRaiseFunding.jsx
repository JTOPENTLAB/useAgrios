import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const RISK_OPTIONS = [
  {
    id: "A",
    label: "Risk A",
    desc: "Short cycle, proven farmer, predictable offtake.",
  },
  {
    id: "B",
    label: "Risk B",
    desc: "Balanced return and risk — most typical cycle.",
  },
  {
    id: "C",
    label: "Risk C",
    desc: "Higher potential return, longer or newer cycle.",
  },
];

export default function FarmerRaiseFunding() {
  const { user } = useAuth();
  const nav = useNavigate();
  const currency = user?.currency || "NGN";
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    crop: "",
    summary: "",
    region: user?.location || "",
    duration_months: 6,
    funding_target: "",
    min_ticket: "5000",
    target_return_pct: "12",
    risk_band: "B",
    use_of_funds: "",
  });

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.summary.length < 20) {
      toast.error("Summary needs at least 20 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        duration_months: Number(form.duration_months),
        funding_target: Number(form.funding_target),
        min_ticket: Number(form.min_ticket),
        target_return_pct: Number(form.target_return_pct),
      };
      await api.post("/opportunities", payload);
      toast.success(
        "Submitted for review. You'll be notified once it's approved.",
      );
      nav("/app/farmer/funding-requests");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6" data-testid="raise-funding-page">
      <Link
        to="/app/farmer"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Farmer · Raise funding
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">
          Submit a funding opportunity
        </h1>
        <p className="text-ink-muted mt-1">
          Request investor capital for a new cycle. Admin-reviewed before it
          goes live to investors.
        </p>
      </div>

      <div className="af-card p-4 flex items-start gap-3 border-l-4 border-l-brand bg-brand/5">
        <Info className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
        <div className="text-sm text-ink-soft">
          Good submissions get approved in under 48 hours. Be specific about
          <b> what you'll grow</b>, <b>where</b>, <b>how you'll spend the money</b>,
          and <b>how you'll repay investors</b>.
        </div>
      </div>

      <form onSubmit={submit} className="af-card p-6 space-y-5" data-testid="raise-form">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Opportunity title
          </label>
          <input
            className="af-input mt-1"
            required
            minLength={6}
            maxLength={120}
            placeholder="e.g. Cassava expansion — 12ha · 6mo cycle"
            value={form.title}
            onChange={upd("title")}
            data-testid="raise-title"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Crop
            </label>
            <input
              className="af-input mt-1"
              required
              placeholder="e.g. Cassava"
              value={form.crop}
              onChange={upd("crop")}
              data-testid="raise-crop"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Region / state
            </label>
            <input
              className="af-input mt-1"
              required
              placeholder="e.g. Oyo"
              value={form.region}
              onChange={upd("region")}
              data-testid="raise-region"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Summary (20–600 chars)
          </label>
          <textarea
            className="af-input mt-1 min-h-[100px]"
            required
            minLength={20}
            maxLength={600}
            placeholder="Scaling our cassava farm from 8ha to 20ha. Funds go to seedlings, labour, and mechanised tilling. 3yr track record on AGRIOS."
            value={form.summary}
            onChange={upd("summary")}
            data-testid="raise-summary"
          />
          <div className="text-[11px] text-ink-muted mt-1">
            {form.summary.length}/600
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Duration (months)
            </label>
            <input
              className="af-input mt-1"
              type="number"
              required
              min="1"
              max="36"
              value={form.duration_months}
              onChange={upd("duration_months")}
              data-testid="raise-duration"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Funding target ({currency})
            </label>
            <input
              className="af-input mt-1"
              type="number"
              required
              min="10000"
              value={form.funding_target}
              onChange={upd("funding_target")}
              placeholder="500000"
              data-testid="raise-target"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Min investor ticket
            </label>
            <input
              className="af-input mt-1"
              type="number"
              required
              min="100"
              value={form.min_ticket}
              onChange={upd("min_ticket")}
              data-testid="raise-min-ticket"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Target return (%)
            </label>
            <input
              className="af-input mt-1"
              type="number"
              required
              step="0.1"
              min="1"
              max="100"
              value={form.target_return_pct}
              onChange={upd("target_return_pct")}
              data-testid="raise-return"
            />
            {form.funding_target && form.target_return_pct && (
              <div className="text-[11px] text-ink-muted mt-1">
                At maturity, investors will be paid back{" "}
                {fmtMoney(
                  Number(form.funding_target) *
                    (1 + Number(form.target_return_pct) / 100),
                  currency,
                )}{" "}
                if fully funded.
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Risk band
            </label>
            <div
              className="grid grid-cols-3 gap-2 mt-1"
              data-testid="raise-risk"
            >
              {RISK_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, risk_band: r.id }))}
                  className={`text-left p-2 rounded-xl border-2 transition ${
                    form.risk_band === r.id
                      ? "border-brand bg-brand/5"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  data-testid={`risk-opt-${r.id}`}
                >
                  <div className="font-heading font-bold text-ink text-sm">
                    {r.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">
              {RISK_OPTIONS.find((x) => x.id === form.risk_band)?.desc}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Use of funds
          </label>
          <textarea
            className="af-input mt-1 min-h-[70px]"
            placeholder="e.g. 40% seedlings · 30% labour · 20% mechanised tilling · 10% working capital"
            value={form.use_of_funds}
            onChange={upd("use_of_funds")}
            data-testid="raise-use-of-funds"
          />
        </div>

        <button
          disabled={submitting}
          className="af-btn-primary w-full disabled:opacity-60"
          data-testid="raise-submit"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Submit for review
            </>
          )}
        </button>
        <div className="text-[11px] text-ink-muted text-center">
          Your submission enters the compliance queue. You'll receive a
          notification when it's approved or needs changes.
        </div>
      </form>
    </div>
  );
}
