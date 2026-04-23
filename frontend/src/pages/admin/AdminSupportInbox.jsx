import { useEffect, useRef, useState } from "react";
import { Inbox, Send, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

export default function AdminSupportInbox() {
  const [threads, setThreads] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const loadThreads = async () => {
    try {
      const r = await api.get("/admin/support/threads");
      setThreads(r.data.threads || []);
      setTotalUnread(r.data.total_unread_admin || 0);
      if (!activeId && r.data.threads?.length) {
        setActiveId(r.data.threads[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (id) => {
    if (!id) return;
    const r = await api.get(`/admin/support/threads/${id}`);
    setActiveThread(r.data.thread);
    setMessages(r.data.messages || []);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  };

  useEffect(() => {
    loadThreads();
    const i = setInterval(loadThreads, 15000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeId) loadThread(activeId);
  }, [activeId]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sending || !activeId) return;
    setSending(true);
    try {
      const r = await api.post(`/admin/support/threads/${activeId}/reply`, { body: text });
      setMessages((m) => [...m, r.data]);
      setReply("");
      loadThreads();
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!activeId) return;
    await api.post(`/admin/support/threads/${activeId}/close`);
    loadThreads();
  };

  return (
    <div data-testid="admin-support-inbox" className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-bold text-brand">Launch support</div>
        <h1 className="font-heading text-3xl font-extrabold text-ink">Founder inbox</h1>
        <p className="text-ink-muted text-sm mt-1">
          Every message from a user during launch week. Reply fast. They're
          counting on you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Thread list */}
        <div className="af-card overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-brand" />
              <span className="font-heading font-bold text-sm">
                Conversations
              </span>
            </div>
            {totalUnread > 0 && (
              <span
                className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5"
                data-testid="admin-support-total-unread"
              >
                {totalUnread} new
              </span>
            )}
          </div>
          <div className="divide-y divide-zinc-100 max-h-[480px] overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-ink-muted text-sm">Loading…</div>
            )}
            {!loading && threads.length === 0 && (
              <div
                className="p-8 text-center text-ink-muted text-sm"
                data-testid="admin-support-empty"
              >
                No conversations yet. When a user messages you, they'll appear
                here.
              </div>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                data-testid={`admin-support-thread-${t.id}`}
                className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition ${
                  activeId === t.id ? "bg-brand/5 border-l-4 border-brand" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-ink truncate">
                    {t.user_name}
                  </div>
                  {t.unread_for_admin > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                      {t.unread_for_admin}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                  {t.last_author_role === "admin" && "You: "}
                  {t.last_message_preview || "No messages yet"}
                </div>
                <div className="text-[10px] text-ink-muted mt-1 flex items-center gap-2">
                  <span className="uppercase">{t.user_role}</span>
                  {t.status === "closed" && (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> closed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation pane */}
        <div className="af-card lg:col-span-2 overflow-hidden flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
              Select a conversation from the left.
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <div className="font-heading font-bold text-ink">
                    {activeThread.user_name}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {activeThread.user_email} · {activeThread.user_role}
                  </div>
                </div>
                {activeThread.status !== "closed" && (
                  <button
                    onClick={close}
                    data-testid="admin-support-close-btn"
                    className="text-[11px] font-semibold text-ink-muted hover:text-ink"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-3 bg-zinc-50 min-h-[340px] max-h-[420px]"
                data-testid="admin-support-conversation"
              >
                {messages.length === 0 && (
                  <div className="text-center text-ink-muted text-sm py-8">
                    No messages yet.
                  </div>
                )}
                {messages.map((m) => {
                  const isMine = m.author_role === "admin";
                  const time = new Date(m.created_at).toLocaleString([], {
                    hour: "2-digit", minute: "2-digit",
                    month: "short", day: "numeric",
                  });
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? "bg-brand text-white rounded-br-sm"
                            : "bg-white border border-zinc-200 text-ink rounded-bl-sm"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${isMine ? "text-white/60" : "text-ink-muted"}`}>
                          {time}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-zinc-100">
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="Reply as founder…"
                    rows={2}
                    maxLength={2000}
                    className="flex-1 resize-none bg-zinc-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                    data-testid="admin-support-reply-input"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    data-testid="admin-support-reply-send"
                    className="bg-brand text-white rounded-xl p-2.5 disabled:opacity-40 hover:bg-brand-dark transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-ink-muted mt-1.5">
                  Cmd/Ctrl + Enter to send · Enter for newline
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
