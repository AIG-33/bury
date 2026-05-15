"use client";

/**
 * Locale-level error boundary. Caught by Next.js when a server component
 * inside `app/[locale]/...` throws (or a client effect throws after
 * hydration). Renders a branded, accessible fallback instead of the bare
 * dark "A server error occurred" screen.
 *
 * Strings are intentionally hardcoded (RU + EN side by side, with the
 * locale read from the URL) — `next-intl` is unsafe to call here because
 * the boundary may render before/around the IntlProvider when the
 * NextIntlClientProvider itself failed to set up.
 */

import { useEffect } from "react";
import { TennisBall } from "@/components/icons/tennis-ball";

const COPY = {
  ru: {
    eyebrow: "Ошибка",
    title: "Что-то пошло не так",
    body: "Мы уже знаем о сбое и чиним. Попробуй обновить страницу — обычно этого хватает.",
    retry: "Обновить",
    home: "На главную",
    digest_label: "Код",
  },
  en: {
    eyebrow: "Error",
    title: "Something went wrong",
    body: "We've been notified and are looking at it. Try reloading the page — it usually works.",
    retry: "Reload",
    home: "Home",
    digest_label: "Code",
  },
} as const;

type Lang = keyof typeof COPY;

function detectLocale(): Lang {
  if (typeof window === "undefined") return "ru";
  const m = window.location.pathname.match(/^\/(ru|en)(\/|$)/);
  return (m?.[1] as Lang | undefined) ?? "ru";
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the server log (Vercel) and the browser console so we can
    // debug. We never include user PII in the message — it's whatever the
    // throwing code passed.
    console.error("[locale-error-boundary]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  const locale = detectLocale();
  const c = COPY[locale];

  return (
    <main className="page-shell flex min-h-[70vh] items-center justify-center">
      <div className="surface-card flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <div className="relative inline-flex h-16 w-16 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-clay-100 blur-md"
          />
          <TennisBall className="relative h-12 w-12 text-ball-500 drop-shadow-[0_4px_12px_rgba(31,138,76,0.3)]" />
        </div>

        <div>
          <p className="label-eyebrow text-clay-700">{c.eyebrow}</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-grass-900">
            {c.title}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            {c.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn btn-primary"
          >
            {c.retry}
          </button>
          <a href={`/${locale}`} className="btn btn-secondary">
            {c.home}
          </a>
        </div>

        {error.digest && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-400">
            {c.digest_label}: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
