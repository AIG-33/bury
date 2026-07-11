"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Trophy } from "lucide-react";

type Props = {
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
};

// Closing module: a single big CTA + the PlayTennis.by mission line.
// Kept extremely calm visually — the page already has plenty of motion.
export function FinalCta({ primaryCtaHref, primaryCtaLabel, secondaryCtaHref }: Props) {
  const t = useTranslations("landing.final");

  return (
    <section className="relative" aria-label={t("title")}>
      <div className="page-shell max-w-[900px] !py-12 text-center md:!py-16">
        <h2
          className="mx-auto font-display font-extrabold leading-tight text-grass-900"
          style={{ fontSize: "clamp(24px, 3.6vw, 36px)", letterSpacing: "-0.5px" }}
        >
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-500 md:text-base">
          {t("body")}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={primaryCtaHref as Route}
            className="btn btn-lg btn-primary group w-full sm:w-auto"
          >
            <span>{primaryCtaLabel}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>

          <Link
            href={secondaryCtaHref as Route}
            className="btn btn-lg btn-secondary w-full sm:w-auto"
          >
            <Trophy className="h-4 w-4 text-grass-600" />
            {t("cta_secondary")}
          </Link>
        </div>

        <div className="hairline mx-auto mt-12 max-w-[120px]" aria-hidden />

        <figure className="mx-auto mt-8 max-w-[720px] space-y-3">
          <blockquote className="font-display text-[17px] font-medium italic leading-snug text-ink-700 md:text-[20px]">
            {t("quote_text")}
          </blockquote>
          <figcaption className="label-eyebrow">{t("quote_author")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
