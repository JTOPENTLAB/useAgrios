import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api, { fmtMoney, fmtDate } from "@/lib/api";

const RISK_CLS = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-gold/10 text-gold-ink border-gold/30",
  C: "bg-rose-50 text-rose-700 border-rose-200",
};

const TABS = [
  { id: "review", label: "Pending review", icon: Clock },
  { id: "open", label: "Open", icon: CheckCircle2 },
  { id: "funded", label: "Funded", icon: ShieldCheck },
  { id: "rejected", label: "Rejected", icon: XCircle },
];

export default function AdminOpportunities() {
  const [tab, setTab] = useState("review");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async (status) => {
    setLoading(true);
    try {
      const r = await api.get(`/opportunities?status=${status}`);
      setRows(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const act = async (opp, decision) => {
    setActingId(opp.id);
    try {
      await api.post(`/opportunities/${opp.id}/${decision}`);
      toast.success(
        decision === "approve"
          ? `'${opp.title}' is now live on the marketplace.`
          : `'${opp.title}' rejected. Farmer notified.`,
      );
      load(tab);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-opportunities">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">
            Compliance
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Opportunity review
          </h1>
          <p className="text-ink-muted mt-1">
            Approve, reject, or review farmer-submitted funding opportunities.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" data-testid="admin-opp-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                tab === t.id
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink-soft border-zinc-200 hover:border-brand/40"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="af-card p-10 text-center text-ink-muted flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="af-card p-10 text-center text-ink-muted"
          data-testid="admin-opp-empty"
        >
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-ink-muted" />
          <div className="font-heading font-bold text-ink">
            Nothing in this queue.
          </div>
          <p className="text-sm mt-1">
            Opportunities matching "{tab}" will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="admin-opp-list">
          {rows.map((o) => (
            <div
              key={o.id}
              className="af-card p-5"
              data-testid={`admin-opp-row-${o.id}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand">
                      {o.crop} · {o.region}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                        RISK_CLS[o.risk_band] || RISK_CLS.B
                      }`}
                    >
                      Risk {o.risk_band}
                    </span>
                    {o.farmer_verified && (
                      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Farmer KYC
                      </span>
                    )}
                  </div>
                  <div className="font-heading font-bold text-ink text-lg mt-1">
                    {o.title}
                  </div>
                  <p className="text-sm text-ink-soft mt-2 line-clamp-2">
                    {o.summary}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-100">
                    <MicroStat
                      label="Farmer"
                      value={o.farmer_name}
                    />
                    <MicroStat
                      label="Target"
                      value={fmtMoney(o.funding_target, o.currency)}
                    />
                    <MicroStat
                      label="Return"
                      value={`${o.target_return_pct}% · ${o.duration_months}mo`}
                    />
                    <MicroStat
                      label="Min ticket"
                      value={fmtMoney(o.min_ticket, o.currency)}
                    />
                  </div>

                  {o.use_of_funds && (
                    <div className="mt-3 text-xs text-ink-muted">
                      <b>Use of funds:</b> {o.use_of_funds}
                    </div>
                  )}
                  <div className="text-xs text-ink-muted mt-2">
                    Submitted {fmtDate(o.created_at)}
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  <Link
                    to={`/app/opportunities/${o.id}`}
                    className="af-btn-ghost justify-center"
                    data-testid={`admin-view-${o.id}`}
                  >
                    <ExternalLink className="w-4 h-4" /> View public
                  </Link>
                  {tab === "review" && (
                    <>
                      <button
                        onClick={() => act(o, "approve")}
                        disabled={actingId === o.id}
                        className="af-btn-primary justify-center disabled:opacity-60"
                        data-testid={`approve-${o.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => act(o, "reject")}
                        disabled={actingId === o.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-60"
                        data-testid={`reject-${o.id}`}
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MicroStat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="font-heading font-bold text-sm text-ink mt-0.5 truncate">
        {value}
      </div>
    </div>
  );
}
