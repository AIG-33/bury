"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { TennisBall } from "@/components/icons/tennis-ball";
import { cn } from "@/lib/utils";

type HelpPanelProps = {
  pageId: string;
  why: ReactNode;
  what: ReactNode[];
  result: ReactNode[];
  /** Visual style of the trigger. `inline` is a tiny `?` next to a heading. */
  /**
   * `button` (default): a labeled "?" chip — looks intentional when the
   * HelpPanel stands alone in a row (most existing admin/coach pages).
   * `inline`: a tiny circular `?` icon to put next to a page heading
   * (e.g. /matches), no label.
   */
  variant?: "inline" | "button";
  /**
   * Kept for backwards compatibility with old callers — has no visual
   * effect now since the panel is collapsed by default and only shown
   * when the user clicks the trigger.
   */
  defaultCollapsed?: boolean;
};

/**
 * HelpPanel — page-level "what is this screen?" explainer.
 *
 * Until 2026-04-23 this was a fat block at the top of every admin/coach
 * page that you had to manually collapse. Players found it noisy on
 * smaller pages, so it now renders as a compact `?` icon button. The
 * three explanatory sections (why / what / result) live behind a
 * centred modal, opened on click. AGENTS.md §3.4 still requires the
 * three blocks per page — only the default visibility changed.
 *
 * `pageId` is preserved so we can later track usage / A-B test which
 * pages need the help to be auto-opened.
 */
export function HelpPanel({
  pageId,
  why,
  what,
  result,
  variant = "button",
}: HelpPanelProps) {
  const t = useTranslations("help.panel");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [open]);

  const trigger =
    variant === "button" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`help-modal-${pageId}`}
        className="inline-flex items-center gap-2 rounded-full border border-grass-200 bg-grass-50/60 px-3 py-1.5 text-xs font-semibold text-grass-800 transition hover:bg-grass-100"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {t("title")}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`help-modal-${pageId}`}
        aria-label={t("title")}
        title={t("title")}
        className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full border border-grass-200 bg-grass-50/70 text-grass-700 transition hover:-translate-y-0.5 hover:bg-grass-100 hover:text-grass-900"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    );

  return (
    <>
      {trigger}
      {mounted && open && createPortal(<HelpModal
        pageId={pageId}
        why={why}
        what={what}
        result={result}
        onClose={() => setOpen(false)}
        closeBtnRef={closeBtnRef}
        labels={{
          title: t("title"),
          why: t("why"),
          what: t("what"),
          result: t("result"),
        }}
      />, document.body)}
    </>
  );
}

function HelpModal({
  pageId,
  why,
  what,
  result,
  onClose,
  closeBtnRef,
  labels,
}: {
  pageId: string;
  why: ReactNode;
  what: ReactNode[];
  result: ReactNode[];
  onClose: () => void;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  labels: { title: string; why: string; what: string; result: string };
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`help-${pageId}-title`}
      id={`help-modal-${pageId}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-grass-100 bg-white shadow-pop">
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-grass-50/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <TennisBall className="h-6 w-6 text-ball-500" />
            <h2
              id={`help-${pageId}-title`}
              className="font-display text-lg font-bold text-grass-900"
            >
              {labels.title}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
            aria-label="close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 md:grid-cols-3">
          <Block label={labels.why}>
            <p className="text-sm text-ink-700">{why}</p>
          </Block>
          <Block label={labels.what}>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {what.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-grass-500"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Block>
          <Block label={labels.result}>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {result.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ball-500"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-grass-50/30 p-4">
      <h3
        className={cn(
          "mb-2 text-xs font-bold uppercase tracking-wider text-grass-800",
        )}
      >
        {label}
      </h3>
      {children}
    </div>
  );
}
