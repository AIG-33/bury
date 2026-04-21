"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone, Apple, X, Share, PlusSquare } from "lucide-react";
import { TennisBall } from "@/components/icons/tennis-ball";

type Labels = {
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

// Type for the (Chrome-only) before-install-prompt event.
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppCard({ labels }: { labels: Labels }) {
  const [open, setOpen] = useState<null | "android" | "ios">(null);
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

  async function triggerNativeInstall() {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setCanPromptInstall(false);
    setOpen(null);
  }

  return (
    <>
      <div className="grid items-start gap-4 rounded-xl3 border border-grass-100 bg-gradient-to-br from-grass-50 via-white to-ball-50/40 p-5 sm:grid-cols-[auto_1fr_auto] sm:gap-5 sm:p-6">
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-card sm:flex">
          <TennisBall className="h-9 w-9 text-ball-500" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-grass-900 sm:text-lg">
            {labels.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {labels.body}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={() => setOpen("android")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-grass-700 px-4 text-[12px] font-mono font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-grass-800"
          >
            <Smartphone className="h-4 w-4" />
            {labels.android_button}
          </button>
          <button
            type="button"
            onClick={() => setOpen("ios")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-ink-900/80 bg-ink-900 px-4 text-[12px] font-mono font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-800"
          >
            <Apple className="h-4 w-4" />
            {labels.ios_button}
          </button>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 backdrop-blur-sm sm:items-center"
        >
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setOpen(null)}
            className="absolute inset-0"
          />
          <div className="relative mx-3 mb-3 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:mx-4 sm:mb-0">
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => setOpen(null)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-700"
            >
              <X className="h-4 w-4" />
            </button>

            {open === "android" ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-grass-700" />
                  <h4 className="font-display text-lg font-bold text-grass-900">
                    {labels.android_modal_title}
                  </h4>
                </div>
                {canPromptInstall && (
                  <button
                    type="button"
                    onClick={triggerNativeInstall}
                    className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-grass-700 px-5 text-[12.5px] font-mono font-semibold uppercase tracking-[0.14em] text-white hover:bg-grass-800"
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
                  <h4 className="font-display text-lg font-bold text-grass-900">
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
      )}
    </>
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
