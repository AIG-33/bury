"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Users2 } from "lucide-react";

type Props = {
  ctaHref: string;
};

// Narrow strip aimed at coaches/clubs. Lives between "How it works" and
// "Final CTA" so the player audience reaches the bottom regardless, while
// coaches still see a clear, separate entry point.
export function CoachCta({ ctaHref }: Props) {
  const t = useTranslations("landing.coach_cta");

  return (
    <section className="relative bg-white" aria-label={t("title")}>
      <div className="page-shell-wide max-w-[1280px] pb-16 pt-2 md:pb-20 md:pt-4">
        <div className="relative overflow-hidden rounded-xl3 border border-ink-900/10 bg-gradient-to-br from-ink-900 via-ink-800 to-grass-900 p-8 text-white md:p-12">
          {/* Decorative grid hairlines */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-ball-500/30 blur-3xl"
          />

          <div className="relative grid grid-cols-12 items-center gap-6">
            <div className="col-span-12 md:col-span-8">
              <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.22em] text-ball-300">
                {t("eyebrow")}
              </p>
              <h2 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight md:text-[34px]">
                {t("title")}
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75 md:text-base">
                {t("body")}
              </p>
            </div>

            <div className="col-span-12 md:col-span-4 md:flex md:justify-end">
              <Link
                href={ctaHref as Route}
                className="ease-followthrough group inline-flex h-12 items-center gap-3 rounded-full bg-ball-500 pl-5 pr-2 font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-ink-900 shadow-[0_18px_44px_-18px_rgba(215,242,5,0.55)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-ball-400"
              >
                <Users2 className="h-4 w-4" />
                <span>{t("cta")}</span>
                <span className="ease-followthrough inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-900/10 transition-transform duration-500 group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
