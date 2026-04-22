import { useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ShieldCheck, Upload, SkipForward, Info, Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function OnboardingKYC() {
  const nav = useNavigate();
  const { refreshState } = useOutletContext() || {};
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const onPick = () => inputRef.current?.click();

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large — 5MB max.");
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploaded(true);
      toast.success("ID uploaded. We'll review within 24h.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const next = async () => {
    try {
      await api.post("/onboarding/advance");
      refreshState && refreshState();
    } catch {
      // non-blocking
    }
    nav("/onboarding/wallet");
  };

  return (
    <div className="space-y-6" data-testid="onboarding-kyc">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand">
          Step 2 · Verification
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink mt-2">
          Verify your identity.
        </h1>
        <p className="text-ink-muted mt-2">
          Required for secure transactions.{" "}
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <Info className="w-3 h-3" /> We use this to meet financial compliance
            rules and protect your wallet.
          </span>
        </p>
      </div>

      <div className="af-card p-6 sm:p-7">
        {uploaded ? (
          <div className="text-center py-8" data-testid="kyc-uploaded-state">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="font-heading font-bold text-ink mt-3">
              Document received
            </div>
            <div className="text-sm text-ink-muted mt-1">
              Review usually completes within 24 hours. You can continue onboarding
              while we verify.
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onPick}
              className="w-full border-2 border-dashed border-zinc-200 rounded-2xl p-8 hover:border-brand/40 hover:bg-brand/5 transition"
              data-testid="kyc-pick-btn"
            >
              <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand grid place-items-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div className="font-heading font-bold text-ink mt-3">
                Upload a government-issued ID
              </div>
              <div className="text-sm text-ink-muted mt-1">
                Drivers license, international passport, or national ID. JPG /
                PNG / PDF up to 5MB.
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                capture="environment"
                className="hidden"
                onChange={onFile}
                data-testid="kyc-file-input"
              />
            </button>

            {file && (
              <div
                className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between gap-3"
                data-testid="kyc-file-chip"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-4 h-4 text-ink-muted flex-shrink-0" />
                  <span className="truncate text-sm text-ink">{file.name}</span>
                </div>
                <button
                  onClick={upload}
                  disabled={uploading}
                  className="af-btn-primary text-xs disabled:opacity-60"
                  data-testid="kyc-upload-btn"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="w-4 h-4 text-brand" />
          Your documents are encrypted at rest. Only compliance operators review
          them.
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={next}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          data-testid="kyc-skip-btn"
        >
          <SkipForward className="w-3.5 h-3.5" /> Skip and complete later
        </button>
        <button
          type="button"
          onClick={next}
          className="af-btn-primary"
          data-testid="kyc-continue-btn"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
