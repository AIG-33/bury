"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  signInWithApple,
  signInWithGoogle,
  oauthErrorLabelKey,
  type OAuthProvider,
} from "@/lib/auth/oauth";

// Compact Apple / Google pair for the mobile start screen (ТЗ Start §00):
// two white pills side by side inside the bottom sheet.

export type StartOAuthLabels = {
  apple: string;
  google: string;
  error: string;
  unavailable: string;
  error_detail: string;
};

function siteBase() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function StartOAuth({ labels }: { labels: StartOAuthLabels }) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errDetail, setErrDetail] = useState<string | null>(null);

  async function handle(provider: OAuthProvider) {
    setErrMsg(null);
    setErrDetail(null);
    setBusy(provider);
    const opts = {
      redirectTo: `${siteBase()}/api/auth/callback`,
      postLoginUrl: `${siteBase()}/api/auth/post-login`,
    };
    const result =
      provider === "google" ? await signInWithGoogle(opts) : await signInWithApple(opts);
    // On success the flow redirects away; only reset on failure.
    if (!result.ok) {
      setBusy(null);
      setErrMsg(
        oauthErrorLabelKey(result.error) === "oauth_unavailable"
          ? labels.unavailable
          : labels.error,
      );
      setErrDetail(result.detail ?? null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <ProviderPill
          label={labels.apple}
          busy={busy === "apple"}
          disabled={busy !== null}
          onClick={() => handle("apple")}
        >
          <AppleMark className="h-[18px] w-[18px]" />
        </ProviderPill>
        <ProviderPill
          label={labels.google}
          busy={busy === "google"}
          disabled={busy !== null}
          onClick={() => handle("google")}
        >
          <GoogleMark className="h-[18px] w-[18px]" />
        </ProviderPill>
      </div>
      {errMsg ? (
        <div role="alert" className="mt-2.5 text-center">
          <p className="text-[12px] font-semibold text-clay-500">{errMsg}</p>
          {errDetail ? (
            <p className="mt-1 break-words text-[11px] font-medium text-clay-500/80">
              {labels.error_detail} {errDetail}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProviderPill({
  label,
  busy,
  disabled,
  onClick,
  children,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-full border border-[rgba(20,60,30,0.1)] bg-white font-display text-[15px] font-bold text-ink-900 shadow-[0_1px_2px_rgba(20,60,30,0.05)] transition-opacity active:opacity-85 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-500" /> : children}
      {label}
    </button>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#000000"
        d="M16.365 1.43c0 1.14-.417 2.2-1.25 3.06-.94.98-2.02 1.55-3.19 1.46a3.02 3.02 0 0 1-.02-.36c0-1.09.48-2.24 1.28-3.06.4-.42.9-.77 1.5-1.05.6-.28 1.17-.44 1.7-.47.01.29.02.58 0 .88Zm4.02 15.16c-.3.7-.44 1.01-.83 1.63-.55.87-1.32 1.95-2.28 1.96-.85 0-1.07-.56-2.23-.55-1.16 0-1.4.54-2.25.55-.96.02-1.69-.94-2.24-1.81-1.53-2.43-1.69-5.28-.75-6.79.67-1.08 1.73-1.71 2.72-1.71 1.01 0 1.65.55 2.49.55.81 0 1.31-.55 2.48-.55.89 0 1.83.48 2.5 1.31-2.2 1.2-1.84 4.34.12 5.36Z"
      />
    </svg>
  );
}
