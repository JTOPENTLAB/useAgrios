import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, HelpCircle } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/** Founder concierge chat — floating widget.
 * - Bottom-right on every authenticated page (skips /login, admin, and /app/admin/support itself).
 * - User sends → backend pings Slack → you reply from admin inbox → user sees it.
 */
export default function SupportChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Hide for admins (they use the inbox) and for signed-out visitors
  const shouldRender =
    user && user.role && user.role !== "admin" &&
    !window.location.pathname.startsWith("/app/admin");

  const refresh = async () => {
    try {
      const r = await api.get("/support/thread");
      setMessages(r.data.messages || []);
      setUnread(r.data.thread?.unread_for_user || 0);
    } catch {
      // fail silently — widget is non-critical
    }
  };

  // Poll: 12s when open, 45s when closed
  useEffect(() => {
    if (!shouldRender) return;
    refresh();
    const interval = setInterval(refresh, open ? 12000 : 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, open]);

  // When user opens widget, mark admin messages as read
  useEffect(() => {
    if (!open || !shouldRender) return;
    api.post("/support/messages/read").catch(() => {});
    setUnread(0);
    // Scroll to bottom on open + new messages
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  }, [open, messages.length, shouldRender]);

  if (!shouldRender) return null;

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic append so the UI feels instant
    const optimistic = {
      id: `local-${Date.now()}`,
      body: text,
      author_role: user.role,
      author_id: user.id,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((m) => [...m, optimistic]);
    setBody("");
    try {
      const r = await api.post("/support/messages", { body: text });
      // Replace optimistic with server record
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? r.data : x)));
    } catch (e) {
      setMessages((m) =>
        m.map((x) =>
          x.id === optimistic.id ? { ...x, _failed: true } : x,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-testid="support-chat-launcher"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand text-white rounded-full shadow-lift px-4 py-3 font-semibold hover:bg-brand-dark transition-all"
          style={{ boxShadow: "0 10px 40px -10px rgba(15,81,50,0.5)" }}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">Ask the founder</span>
          {unread > 0 && (
            <span
              className="ml-1 bg-gold text-ink text-[10px] font-bold rounded-full px-2 py-0.5"
              data-testid="support-chat-unread-badge"
            >
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          data-testid="support-chat-panel"
          className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-zinc-100 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-heading font-bold text-sm">Talk to the founder</div>
              <div className="text-[11px] text-white/70">Real human · launch support</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white"
              data-testid="support-chat-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50 min-h-[240px]"
            data-testid="support-chat-messages"
          >
            {messages.length === 0 && (
              <div className="text-center py-8" data-testid="support-chat-empty">
                <HelpCircle className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                <div className="text-sm text-ink-muted">
                  Ask anything — I read every message personally during launch week.
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {[
                    "How does my first investment work?",
                    "I need help with KYC",
                    "How are funds secured?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setBody(q)}
                      className="text-xs text-brand hover:underline"
                      data-testid="support-chat-suggested-q"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} isMine={m.author_role !== "admin"} />
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message…"
                rows={1}
                maxLength={2000}
                className="flex-1 resize-none bg-zinc-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                data-testid="support-chat-input"
              />
              <button
                onClick={send}
                disabled={!body.trim() || sending}
                className="bg-brand text-white rounded-xl p-2.5 disabled:opacity-40 hover:bg-brand-dark transition"
                data-testid="support-chat-send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-ink-muted mt-1.5">
              Typical reply time: under 1 hour during launch week.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ m, isMine }) {
  const time = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      data-testid={`support-chat-msg-${m.author_role}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          isMine
            ? "bg-brand text-white rounded-br-sm"
            : "bg-white border border-zinc-200 text-ink rounded-bl-sm"
        } ${m._failed ? "opacity-50" : ""} ${m._optimistic ? "opacity-60" : ""}`}
      >
        {!isMine && (
          <div className="text-[10px] font-bold text-brand mb-0.5">Founder</div>
        )}
        <div className="whitespace-pre-wrap">{m.body}</div>
        <div
          className={`text-[10px] mt-1 ${
            isMine ? "text-white/60" : "text-ink-muted"
          }`}
        >
          {time}
          {m._failed && " · failed"}
        </div>
      </div>
    </div>
  );
}
