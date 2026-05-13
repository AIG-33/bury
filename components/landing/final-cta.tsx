"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BarChart3 } from "lucide-react";

type Props = {
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
};

// Closing module: a single big CTA + the OpenCourt.by mission line.
// Kept extremely calm visually — the page already has plenty of motion.
export function FinalCta({ primaryCtaHref, primaryCtaLabel, secondaryCtaHref }: Props) {
  const t = useTranslations("landing.final");

  return (
    <section className="relative bg-grass-50" aria-label={t("title")}>
      <div className="page-shell-wide max-w-[1100px] py-20 text-center md:py-28">
        <h2
          className="mx-auto font-display font-bold leading-[0.98] tracking-tightest text-grass-900"
          style={{ fontSize: "clamp(32px, 4.4vw, 56px)" }}
        >
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-600 md:text-[17px]">
          {t("body")}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryCtaHref as Route}
            className="ease-followthrough group inline-flex h-12 items-center gap-3 rounded-full bg-grass-700 pl-6 pr-3 font-display text-[13px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_44px_-18px_rgba(31,138,76,0.65)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-grass-800 hover:shadow-[0_28px_70px_-20px_rgba(31,138,76,0.75)]"
          >
            <span>{primaryCtaLabel}</span>
            <span className="ease-followthrough inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href={secondaryCtaHref as Route}
            className="ease-followthrough group inline-flex h-12 items-center gap-2 rounded-full border border-ink-300/80 bg-white/60 px-5 font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-ink-800 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-grass-700 hover:bg-white hover:text-grass-800"
          >
            <BarChart3 className="h-4 w-4 text-grass-700" />
            {t("cta_secondary")}
          </Link>
        </div>

        <div className="hairline mx-auto mt-16 max-w-[120px]" aria-hidden />

        <figure className="mx-auto mt-10 max-w-[760px] space-y-3">
          <blockquote className="font-display text-[20px] italic leading-snug text-ink-700 md:text-[24px]">
            {t("quote_text")}
          </blockquote>
          <figcaption className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            {t("quote_author")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
