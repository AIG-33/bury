"use client";

import { Loader2 } from "lucide-react";
import type { OAuthProvider } from "@/lib/auth/oauth";

export type OAuthButtonsLabels = {
  or_divider: string;
  continue_google: string;
  continue_apple: string;
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
          <GoogleMark className="h-5 w-5" />
        </ProviderButton>

        <ProviderButton
          label={labels.continue_apple}
          busy={busyProvider === "apple"}
          disabled={disabled}
          onClick={() => onProvider("apple")}
        >
          <AppleMark className="h-5 w-5" />
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
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-ink-200/80 bg-white/90 text-[14px] font-medium text-ink-800 transition hover:border-ink-300 hover:bg-white disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-ink-500" />
      ) : (
        <span className="inline-flex h-5 w-5 items-center justify-center">{children}</span>
      )}
      <span>{label}</span>
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
