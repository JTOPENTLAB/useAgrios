import { useEffect, useState } from "react";
import { ShieldCheck, MapPin, Camera, FileText, CheckCircle2, Users, AlertTriangle, Search } from "lucide-react";
import api from "@/lib/api";

const BADGE_META = [
  { id: "identity_verified", icon: ShieldCheck, label: "Identity" },
  { id: "farm_verified", icon: MapPin, label: "Farm" },
  { id: "site_visit", icon: Camera, label: "Site visit" },
  { id: "offtake_signed", icon: FileText, label: "Offtake" },
  { id: "track_record", icon: Users, label: "Track record" },
  { id: "reporting_current", icon: CheckCircle2, label: "Reporting" },
];

// Derive badge state from platform data — read-only v1.
function deriveBadges(user) {
  const verified = !!user.verified;
  const completed = user.completed_orders || 0;
  const hasFarm = !!user.farm_lat || verified;
  return {
    identity_verified: verified,
    farm_verified: hasFarm,
    site_visit: verified && completed > 0,
    offtake_signed: completed > 2,
    track_record: completed >= 3,
    reporting_current: (user.days_since_last_update ?? 0) < 7,
  };
}

export default function AdminTrustOps() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get("/admin/users", { params: { role: "farmer" } })
      .then((r) => setFarmers(Array.isArray(r.data) ? r.data : r.data.items || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = farmers.filter((f) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (f.full_name || "").toLowerCase().includes(s) ||
      (f.email || "").toLowerCase().includes(s) ||
      (f.country || "").toLowerCase().includes(s)
    );
  });

  const toggleVerify = async (userId, next) => {
    try {
      await api.post(`/admin/users/${userId}/verify`, { verified: next });
      setFarmers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, verified: next } : u)),
      );
    } catch {
      // Intentionally swallow — server-side log covers audit
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-trust-ops">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand">
            Trust operations
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-ink">
            Farmer verification board
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Read the live state of every farmer's trust badges. Toggle identity verification inline.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search farmers"
            className="af-input pl-9 w-64"
            data-testid="trust-search-input"
          />
        </div>
      </div>

      {/* Badge legend */}
      <div className="af-card p-4 flex items-center gap-4 flex-wrap text-xs">
        {BADGE_META.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.id} className="inline-flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-ink-muted" />
              <span className="text-ink-muted">{b.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-ink-muted">Green = earned · Grey = missing</span>
      </div>

      <div className="af-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-ink-muted">
            <tr>
              <th className="p-4 font-semibold">Farmer</th>
              <th className="p-4 font-semibold">Badges</th>
              <th className="p-4 font-semibold text-right">Score</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-ink-muted">
                  Loading farmers…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-ink-muted" data-testid="trust-empty">
                  No farmers match the filter.
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const badges = deriveBadges(f);
                const earned = Object.values(badges).filter(Boolean).length;
                const scorePct = Math.round((earned / BADGE_META.length) * 100);
                return (
                  <tr
                    key={f.id}
                    className="border-t border-zinc-100"
                    data-testid={`trust-row-${f.id}`}
                  >
                    <td className="p-4">
                      <div className="font-heading font-bold text-ink">
                        {f.full_name || f.email}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {f.email} · {f.country || "—"}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {BADGE_META.map((b) => {
                          const Icon = b.icon;
                          const earned = badges[b.id];
                          return (
                            <span
                              key={b.id}
                              title={b.label + (earned ? " — earned" : " — missing")}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                                earned
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-zinc-50 text-ink-muted border-zinc-200"
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              {b.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-heading font-extrabold text-xl text-ink">
                        {scorePct}
                      </div>
                      <div className="text-[10px] text-ink-muted uppercase font-bold">
                        trust %
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {f.verified ? (
                        <button
                          onClick={() => toggleVerify(f.id, false)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                          data-testid={`trust-revoke-${f.id}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleVerify(f.id, true)}
                          className="af-btn-primary text-xs"
                          data-testid={`trust-verify-${f.id}`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Verify
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
