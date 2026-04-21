"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { TennisBall } from "@/components/icons/tennis-ball";
import { cn } from "@/lib/utils";

type HelpPanelProps = {
  pageId: string;
  why: ReactNode;
  what: ReactNode[];
  result: ReactNode[];
  defaultCollapsed?: boolean;
};

const STORAGE_PREFIX = "tennis.help.";

export function HelpPanel({
  pageId,
  why,
  what,
  result,
  defaultCollapsed = false,
}: HelpPanelProps) {
  const t = useTranslations("help.panel");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + pageId);
    if (stored !== null) setCollapsed(stored === "1");
    setHydrated(true);
  }, [pageId]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_PREFIX + pageId, next ? "1" : "0");
      return next;
    });
  }

  return (
    <section
      aria-labelledby={`help-${pageId}`}
      className="rounded-xl2 border border-grass-100 bg-grass-50/60 shadow-card"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls={`help-body-${pageId}`}
        className="flex w-full items-center justify-between gap-3 rounded-xl2 px-5 py-4 text-left transition hover:bg-grass-50"
      >
        <span className="flex items-center gap-3">
          <TennisBall className="h-5 w-5 text-ball-500" />
          <span
            id={`help-${pageId}`}
            className="font-display text-base font-semibold text-grass-800"
          >
            {t("title")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-grass-700 transition-transform",
            !collapsed && "rotate-180",
          )}
        />
      </button>
      {hydrated && !collapsed && (
        <div
          id={`help-body-${pageId}`}
          className="grid gap-4 px-5 pb-5 md:grid-cols-3"
        >
          <Block label={t("why")} variant="why">
            <p className="text-sm text-ink-700">{why}</p>
          </Block>
          <Block label={t("what")} variant="what">
            <ul className="space-y-1.5 text-sm text-ink-700">
              {what.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-grass-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Block>
          <Block label={t("result")} variant="result">
            <ul className="space-y-1.5 text-sm text-ink-700">
              {result.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ball-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      )}
      {hydrated && collapsed && (
        <div className="flex items-center gap-2 px-5 pb-4 text-xs text-grass-700">
          <Eye className="h-3.5 w-3.5" />
          <span>{t("collapsed_hint")}</span>
        </div>
      )}
    </section>
  );
}

function Block({
  label,
  variant,
  children,
}: {
  label: string;
  variant: "why" | "what" | "result";
  children: ReactNode;
}) {
  const palette = {
    why: "text-grass-800",
    what: "text-grass-800",
    result: "text-grass-800",
  }[variant];

  return (
    <div className="rounded-xl border border-white bg-white/70 p-4">
      <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wider", palette)}>
        {label}
      </h3>
      {children}
    </div>
  );
}
