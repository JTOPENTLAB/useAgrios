import { useEffect, useState, useRef } from "react";
import { Bell, Check } from "lucide-react";
import api, { fmtDate } from "@/lib/api";

export default function NotificationsBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => api.get("/notifications").then((r) => setData(r.data)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const markOne = async (id) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 grid place-items-center transition"
        data-testid="notifications-bell"
      >
        <Bell className="w-4 h-4 text-ink-soft" />
        {data.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center px-1" data-testid="notifications-unread-count">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[440px] overflow-auto af-card shadow-lift z-40" data-testid="notifications-dropdown">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
            <div className="font-heading font-bold">Notifications</div>
            {data.unread > 0 && (
              <button onClick={markAll} className="text-xs text-brand font-semibold flex items-center gap-1" data-testid="mark-all-read">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          {data.items.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-sm">You're all caught up 🌾</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`w-full text-left p-4 hover:bg-zinc-50 ${n.read ? "opacity-60" : ""}`}
                  data-testid={`notif-${n.id}`}
                >
                  <div className="flex justify-between gap-2">
                    <div className="font-semibold text-sm text-ink">{n.title}</div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">{n.body}</div>
                  <div className="text-[10px] text-ink-muted mt-1">{fmtDate(n.created_at)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
