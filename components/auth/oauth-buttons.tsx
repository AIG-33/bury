"use client";

import { Loader2 } from "lucide-react";
import type { OAuthProvider } from "@/lib/auth/oauth";
import { AppleLogo, GoogleLogo } from "@/components/auth/provider-logos";

export type OAuthButtonsLabels = {
  or_divider: string;
  continue_google: string;
  signin_apple: string;
};

export function OAuthButtons({
  labels,
  onProvider,
  busyProvider,
  disabled,
}: {
  labels: OAuthButtonsLabels;
  onProvider: (provider: OAuthProvider) => void;
  busyProvider: OAuthProvider | null;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <ProviderButton
          label={labels.continue_google}
          busy={busyProvider === "google"}
          disabled={disabled}
          onClick={() => onProvider("google")}
        >
          <GoogleLogo className="h-5 w-5" />
        </ProviderButton>

        {/* Sign in with Apple, per HIG: black button, white official Apple
            logo + title, no recoloring. Capsule corner radius is an allowed
            HIG variant and matches the app's button shape. */}
        <ProviderButton
          label={labels.signin_apple}
          busy={busyProvider === "apple"}
          disabled={disabled}
          onClick={() => onProvider("apple")}
          variant="apple"
        >
          <AppleLogo className="h-[17px] w-[13.5px]" />
        </ProviderButton>
      </div>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-ink-200/70" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
          {labels.or_divider}
        </span>
        <span className="h-px flex-1 bg-ink-200/70" />
      </div>
    </div>
  );
}

function ProviderButton({
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
        "inline-flex h-12 w-full items-center justify-center gap-3 rounded-full text-[14px] font-medium transition disabled:opacity-60",
        variant === "apple"
          ? "bg-black text-white hover:bg-black/85"
          : "border border-ink-200/80 bg-white/90 text-ink-800 hover:border-ink-300 hover:bg-white",
      ].join(" ")}
    >
      {busy ? (
        <Loader2
          className={`h-4 w-4 animate-spin ${variant === "apple" ? "text-white/80" : "text-ink-500"}`}
        />
      ) : (
        <span className="inline-flex h-5 w-5 items-center justify-center">{children}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
