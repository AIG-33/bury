"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type HelpTooltipProps = {
  term: string;
  size?: "sm" | "md";
  // When provided, these override the glossary lookup. Useful for inline
  // contextual hints in forms (where keys don't belong in the global glossary).
  description?: string;
  title?: string;
};

export function HelpTooltip({
  term,
  size = "sm",
  description,
  title: titleOverride,
}: HelpTooltipProps) {
  const useGlossary = !description;
  const t = useTranslations(useGlossary ? `help.glossary.${term}` : "help");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  let title = titleOverride ?? term;
  let body = description ?? "—";
  if (useGlossary) {
    try {
      title = t("title");
      body = t("body");
    } catch {
      title = term;
      body = "—";
    }
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-grass-600 transition hover:text-grass-700",
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
        )}
        aria-label={`Help: ${title}`}
        aria-expanded={open}
      >
        <HelpCircle className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-ink-200 bg-white p-3 text-left text-xs shadow-card"
        >
          <span className="mb-1 block font-semibold text-ink-900">{title}</span>
          <span className="block text-ink-700">{body}</span>
        </span>
      )}
    </span>
  );
}
