import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const nav = useNavigate();
  const { applyGoogleSession } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const sessionId = params.get("session_id");
    const role = params.get("role") || undefined;
    const next = params.get("next") || null;
    const country = params.get("country") || undefined;

    if (!sessionId) {
      nav("/login?error=missing_session", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", {
          session_id: sessionId,
          role,
          country,
        });
        applyGoogleSession(data);
        // Clean the URL fragment
        window.history.replaceState(null, "", window.location.pathname);
        if (next) {
          nav(next, { replace: true });
        } else {
          nav(data.next_hint || "/app", { replace: true });
        }
      } catch (e) {
        const msg = e?.response?.data?.detail || "Google sign-in failed";
        nav(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
      }
    })();
  }, [applyGoogleSession, nav]);

  return (
    <div
      className="min-h-screen grid place-items-center bg-[#FAFAFA]"
      data-testid="auth-callback-page"
    >
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto" />
        <div className="mt-4 font-heading font-bold text-ink">
          Signing you in…
        </div>
        <div className="text-sm text-ink-muted mt-1">
          Verifying your Google account.
        </div>
      </div>
    </div>
  );
}
