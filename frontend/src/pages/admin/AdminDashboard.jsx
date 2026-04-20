import { useEffect, useState } from "react";
import api, { fmtNGN } from "@/lib/api";
import StatCard from "@/components/StatCard";
import { Users, ShoppingBag, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const [m, setM] = useState(null);
  useEffect(() => { api.get("/admin/overview").then((r) => setM(r.data)); }, []);

  if (!m) return <div className="af-card p-10 text-center text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-dark">Operations</div>
        <h1 className="font-heading font-extrabold text-3xl text-ink">Admin Overview</h1>
        <p className="text-ink-muted mt-1">Platform health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 af-stagger">
        <StatCard label="Total users" value={m.users} sub={`${m.farmers} farmers · ${m.buyers} buyers`} tone="brand" testId="admin-users" />
        <StatCard label="Active listings" value={m.active_listings} sub="Published produce" tone="gold" testId="admin-listings" />
        <StatCard label="Orders" value={m.orders} sub={`${m.completed_orders} completed`} tone="blue" testId="admin-orders" />
        <StatCard label="Open disputes" value={m.open_disputes} sub="Needs attention" tone="rose" testId="admin-disputes-count" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="af-card p-6 lg:col-span-2 bg-gradient-to-br from-brand to-brand-dark text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-gold/90">Platform volume</div>
          <div className="mt-2 font-heading font-extrabold text-5xl">{fmtNGN(m.gmv)}</div>
          <div className="text-white/70 mt-1">Gross merchandise value (all orders)</div>
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Platform commission</div>
              <div className="font-heading font-extrabold text-2xl mt-1">{fmtNGN(m.platform_commission)}</div>
            </div>
            <div>
              <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Completion rate</div>
              <div className="font-heading font-extrabold text-2xl mt-1">
                {m.orders ? Math.round((m.completed_orders / m.orders) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
        <div className="af-card p-6 space-y-4">
          <h3 className="font-heading font-bold">Quick actions</h3>
          <a href="/app/admin/users" className="block af-btn-secondary"><Users className="w-4 h-4" /> Manage users</a>
          <a href="/app/admin/disputes" className="block af-btn-secondary"><AlertTriangle className="w-4 h-4" /> Review disputes</a>
          <a href="/app/marketplace" className="block af-btn-secondary"><ShoppingBag className="w-4 h-4" /> Browse marketplace</a>
        </div>
      </div>
    </div>
  );
}
