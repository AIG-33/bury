"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  signInWithApple,
  signInWithGoogle,
  oauthErrorLabelKey,
  type OAuthProvider,
} from "@/lib/auth/oauth";
import { AppleLogo, GoogleLogo } from "@/components/auth/provider-logos";

// Compact Apple / Google pair for the mobile start screen (ТЗ Start §00):
// two pills side by side inside the bottom sheet. The Apple pill follows the
// Sign in with Apple HIG: black button, official white Apple logo, official
// title («Вход с Apple» / "Sign in with Apple") — see provider-logos.tsx.

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
          variant="apple"
        >
          <AppleLogo className="h-[17px] w-[13.5px]" />
        </ProviderPill>
        <ProviderPill
          label={labels.google}
          busy={busy === "google"}
          disabled={busy !== null}
          onClick={() => handle("google")}
        >
          <GoogleLogo className="h-[18px] w-[18px]" />
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
  variant = "default",
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "apple";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-2 font-display text-[14px] font-bold transition-opacity active:opacity-85 disabled:opacity-60",
        variant === "apple"
          ? "bg-black text-white"
          : "border border-[rgba(20,60,30,0.1)] bg-white text-ink-900 shadow-[0_1px_2px_rgba(20,60,30,0.05)]",
      ].join(" ")}
    >
      {busy ? (
        <Loader2
          className={`h-[18px] w-[18px] animate-spin ${variant === "apple" ? "text-white/80" : "text-ink-500"}`}
        />
      ) : (
        children
      )}
      {label}
    </button>
  );
}
