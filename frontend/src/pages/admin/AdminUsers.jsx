import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import api, { fmtDate } from "@/lib/api";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/users").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const verify = async (id) => {
    try {
      await api.post(`/admin/users/${id}/verify`);
      toast.success("User verified");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <h1 className="font-heading font-extrabold text-3xl text-ink">Users</h1>
      <div className="af-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-ink-muted font-bold tracking-wider">
            <tr>
              <th className="text-left p-4">User</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Location</th>
              <th className="text-left p-4">KYC</th>
              <th className="text-left p-4">Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="p-4">
                  <div className="font-semibold text-ink">{u.full_name}</div>
                  <div className="text-xs text-ink-muted">{u.email}</div>
                </td>
                <td className="p-4"><span className="af-chip capitalize">{u.role}</span></td>
                <td className="p-4">{u.location || "—"}</td>
                <td className="p-4">
                  {u.verified ? <span className="af-badge-verified"><ShieldCheck className="w-3 h-3" /> Verified</span> : <span className="af-badge-pending">{u.kyc_status || "unverified"}</span>}
                </td>
                <td className="p-4 text-ink-muted text-xs">{fmtDate(u.created_at)}</td>
                <td className="p-4 text-right">
                  {!u.verified && (
                    <button onClick={() => verify(u.id)} className="af-btn-primary py-1.5 px-3 text-xs" data-testid={`verify-${u.id}`}>Verify</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
