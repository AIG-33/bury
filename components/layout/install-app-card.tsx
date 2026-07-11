"use client";

/**
 * Install-as-PWA UX, three pieces sharing the same modal logic via context.
 *
 *   <InstallAppProvider labels={...}>      ← top-level (in app layout)
 *     ...app...
 *     <InstallAppPrompt labels={...} />    ← floating toast for first-time visitors
 *     ...
 *   </InstallAppProvider>
 *
 *   <InstallAppIcons />                   ← compact icons for the footer
 *
 * The provider owns:
 *   - the open/close state of the Android / iOS instruction dialogs
 *   - the Chrome-only `beforeinstallprompt` deferred event
 *   - the actual modal markup (single instance, mounted at the provider root)
 *
 * The icons and the prompt are passive triggers that read context and call
 * `openDialog("android" | "ios")`.
 *
 * Localisation strings are passed in by the server layout (see
 * `app/[locale]/layout.tsx`) so we don't have a second translation lookup
 * inside a "use client" component.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Apple,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstallAppLabels = {
  title: string;
  body: string;
  android_button: string;
  ios_button: string;
  android_modal_title: string;
  android_step_1: string;
  android_step_2: string;
  android_step_3: string;
  android_install_native: string;
  android_native_hint: string;
  ios_modal_title: string;
  ios_step_1: string;
  ios_step_2: string;
  ios_step_3: string;
  close: string;
};

export type InstallPromptLabels = {
  /** Short headline shown in the floating toast. */
  prompt_headline: string;
  /** One-sentence body. */
  prompt_body: string;
  prompt_android: string;
  prompt_ios: string;
  prompt_dismiss: string;
};

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type DialogKind = "android" | "ios";

type InstallContextValue = {
  open: DialogKind | null;
  openDialog: (kind: DialogKind) => void;
  closeDialog: () => void;
  /** True while Chrome's beforeinstallprompt event is alive (mobile Chrome). */
  canPromptInstall: boolean;
  /** Trigger Chrome's native install dialog. No-op if not available. */
  triggerNativeInstall: () => Promise<void>;
};

const InstallContext = createContext<InstallContextValue | null>(null);

function useInstallContext(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) {
    throw new Error(
      "InstallAppIcons / InstallAppPrompt must be rendered inside an <InstallAppProvider>",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider — owns state + renders the Android/iOS instruction modal
// ---------------------------------------------------------------------------

export function InstallAppProvider({
  labels,
  children,
}: {
  labels: InstallAppLabels;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<DialogKind | null>(null);
  const deferredRef = useRef<BIPEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BIPEvent;
      setCanPromptInstall(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const openDialog = useCallback((kind: DialogKind) => setOpen(kind), []);
  const closeDialog = useCallback(() => setOpen(null), []);

  const triggerNativeInstall = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setCanPromptInstall(false);
    setOpen(null);
  }, []);

  const value = useMemo<InstallContextValue>(
    () => ({ open, openDialog, closeDialog, canPromptInstall, triggerNativeInstall }),
    [open, openDialog, closeDialog, canPromptInstall, triggerNativeInstall],
  );

  return (
    <InstallContext.Provider value={value}>
      {children}
      {open && <InstallDialog labels={labels} />}
    </InstallContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Compact icons — drop into the footer (or anywhere else)
// ---------------------------------------------------------------------------

export function InstallAppIcons({
  labels,
  size = "md",
  className,
}: {
  labels: Pick<InstallAppLabels, "android_button" | "ios_button">;
  size?: "sm" | "md";
  className?: string;
}) {
  const { openDialog } = useInstallContext();

  const dim = size === "sm" ? "h-9 px-3 text-[12px]" : "h-10 px-3.5 text-[13px]";

  return (
    <div className={["flex items-center gap-2", className ?? ""].join(" ")}>
      <button
        type="button"
        onClick={() => openDialog("android")}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-full bg-pt-primary font-display font-bold text-white shadow-card transition hover:opacity-95",
          dim,
        ].join(" ")}
        aria-label={labels.android_button}
        title={labels.android_button}
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{labels.android_button}</span>
      </button>
      <button
        type="button"
        onClick={() => openDialog("ios")}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-900/80 bg-ink-900 font-display font-bold text-white shadow-card transition hover:bg-ink-800",
          dim,
        ].join(" ")}
        aria-label={labels.ios_button}
        title={labels.ios_button}
      >
        <Apple className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{labels.ios_button}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating prompt — shown bottom-center on mobile after a short delay
// ---------------------------------------------------------------------------

const DISMISS_KEY = "playtennis.installPrompt.dismissedAt";
const DISMISS_TTL_DAYS = 14; // Re-prompt after two weeks if user dismissed.
const SHOW_DELAY_MS = 6000; // Don't ambush: wait until the user has read something.

export function InstallAppPrompt({ labels }: { labels: InstallPromptLabels }) {
  const { openDialog } = useInstallContext();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on small screens — desktop users shouldn't be prompted to
    // install a mobile-flavoured PWA.
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    // Already installed (running as a standalone PWA)? Skip.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari special case
      (window as unknown as { navigator?: { standalone?: boolean } }).navigator
        ?.standalone === true;
    if (isStandalone) return;

    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = Number(raw);
        if (Number.isFinite(dismissedAt)) {
          const ageMs = Date.now() - dismissedAt;
          if (ageMs < DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000) return;
        }
      }
    } catch {
      // localStorage blocked → still show, fail open.
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={labels.prompt_headline}
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
      // Sit just above the bottom tab bar (which is `h-[64px]` on mobile).
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-grass-200 bg-white/95 shadow-2xl backdrop-blur-md ring-1 ring-grass-100 lg:hidden">
        <div className="flex items-start gap-3 p-3.5">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-semibold leading-tight text-grass-900">
              {labels.prompt_headline}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-600">
              {labels.prompt_body}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  openDialog("android");
                  dismiss();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-pt-primary px-3 font-display text-[12px] font-bold text-white hover:opacity-95"
              >
                <Smartphone className="h-3.5 w-3.5" />
                {labels.prompt_android}
              </button>
              <button
                type="button"
                onClick={() => {
                  openDialog("ios");
                  dismiss();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-900/80 bg-ink-900 px-3 font-display text-[12px] font-bold text-white hover:bg-ink-800"
              >
                <Apple className="h-3.5 w-3.5" />
                {labels.prompt_ios}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2 font-display text-[12px] font-bold text-ink-500 hover:text-ink-700"
              >
                {labels.prompt_dismiss}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={labels.prompt_dismiss}
            className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal — the Android / iOS instruction modal (single instance per provider)
// ---------------------------------------------------------------------------

function InstallDialog({ labels }: { labels: InstallAppLabels }) {
  const { open, closeDialog, canPromptInstall, triggerNativeInstall } =
    useInstallContext();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 backdrop-blur-sm sm:items-center"
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={closeDialog}
        className="absolute inset-0"
      />
      <div className="relative mx-3 mb-3 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:mx-4 sm:mb-0">
        <button
          type="button"
          aria-label={labels.close}
          onClick={closeDialog}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-700"
        >
          <X className="h-4 w-4" />
        </button>

        {open === "android" ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-grass-700" />
              <h4 className="section-title text-[18px] md:text-[20px]">
                {labels.android_modal_title}
              </h4>
            </div>
            {canPromptInstall && (
              <button
                type="button"
                onClick={triggerNativeInstall}
                className="btn btn-primary mb-4 w-full"
              >
                {labels.android_install_native}
              </button>
            )}
            {canPromptInstall && (
              <p className="mb-4 text-[12px] text-ink-500">
                {labels.android_native_hint}
              </p>
            )}
            <ol className="space-y-3 text-sm text-ink-700">
              <Step n={1} text={labels.android_step_1} />
              <Step n={2} text={labels.android_step_2} />
              <Step n={3} text={labels.android_step_3} />
            </ol>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Apple className="h-5 w-5 text-ink-900" />
              <h4 className="section-title text-[18px] md:text-[20px]">
                {labels.ios_modal_title}
              </h4>
            </div>
            <ol className="space-y-3 text-sm text-ink-700">
              <Step n={1} text={labels.ios_step_1} />
              <Step
                n={2}
                text={labels.ios_step_2}
                icon={<Share className="h-4 w-4 text-grass-700" />}
              />
              <Step
                n={3}
                text={labels.ios_step_3}
                icon={<PlusSquare className="h-4 w-4 text-grass-700" />}
              />
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  text,
  icon,
}: {
  n: number;
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grass-100 text-[11px] font-bold text-grass-800">
        {n}
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        {text}
        {icon && (
          <span className="ml-2 inline-flex translate-y-0.5 items-center align-middle">
            {icon}
          </span>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Backwards compatibility: the old big card. Kept as a thin re-export of the
// icons + provider so any stray imports don't break, but the visual is gone.
// Prefer InstallAppIcons + InstallAppProvider in new code.
// ---------------------------------------------------------------------------

/** @deprecated Use <InstallAppProvider> + <InstallAppIcons> instead. */
export function InstallAppCard(_props: { labels: InstallAppLabels }) {
  return null;
}
