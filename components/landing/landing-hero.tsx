"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Route } from "next";
import { ArrowRight, BarChart3 } from "lucide-react";
import { LivingBall } from "./living-ball";
import { LightTennisBackdrop } from "./light-tennis-backdrop";

type Props = {
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

// Hero is intentionally value-first: a plain-language promise is the H1 (not
// the brand), two CTAs reduce sign-up friction, and a four-stat trust strip
// gives anonymous visitors immediate proof the platform is real.
export function LandingHero({ primaryCtaHref, primaryCtaLabel, secondaryCtaHref }: Props) {
  const t = useTranslations("landing.hero");
  const tt = useTranslations("landing.trust");

  const trust = [
    {
      key: "cities",
      value: tt("items.cities.value"),
      label: tt("items.cities.label"),
    },
    {
      key: "venues",
      value: tt("items.venues.value"),
      label: tt("items.venues.label"),
    },
    {
      key: "formats",
      value: tt("items.formats.value"),
      label: tt("items.formats.label"),
    },
  ] as const;

  return (
    <section className="film-grain relative isolate overflow-hidden bg-grass-50 text-ink-900">
      <LightTennisBackdrop className="-z-10" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col px-6 pt-16 md:px-12 md:pt-20">
        {/* Eyebrow row: factual, no buzzwords */}
        <motion.div
          className="flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <span
            className="inline-flex h-6 items-center gap-1.5 rounded-full bg-grass-700/10 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-grass-800"
            aria-label={t("badge_free")}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-grass-700" />
            {t("badge_free")}
          </span>
        </motion.div>

        {/* Stage: headline left, decorative ball right */}
        <div className="mt-10 grid grid-cols-12 items-center gap-6 md:mt-14">
          <div className="col-span-12 md:col-span-7">
            <motion.h1
              className="font-display font-bold leading-[0.95] tracking-tightest text-ink-900"
              style={{ fontSize: "clamp(40px, 6.4vw, 84px)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <span className="block">{t("title_line_1")}</span>
              <span className="block">{t("title_line_2")}</span>
              <span className="block text-grass-800">{t("title_line_3")}</span>
            </motion.h1>

            <motion.p
              className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-700 md:text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            >
              {t("subtitle")}
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
            >
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
            </motion.div>
          </div>

          {/* Decorative ball — shrunk so it never competes with the headline */}
          <div className="relative col-span-12 md:col-span-5">
            <div className="relative -mr-[10vw] ml-auto aspect-square w-[55vw] max-w-[260px] md:mx-auto md:mr-0 md:w-[22vw] md:max-w-[320px]">
              <LivingBall className="absolute inset-0" />
            </div>
          </div>
        </div>

        {/* Trust strip — concrete numbers, no marketing fluff */}
        <motion.div
          className="mt-14 border-t border-ink-900/10 pt-6 md:mt-20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        >
          <p className="label-eyebrow">{tt("label")}</p>
          <ul className="mt-4 grid grid-cols-3 gap-x-6 gap-y-5">
            {trust.map((item) => (
              <li key={item.key} className="flex flex-col gap-1">
                <span className="tabular font-display text-2xl font-bold leading-none text-grass-900 md:text-3xl">
                  {item.value}
                </span>
                <span className="text-[13.5px] leading-snug text-ink-600 md:text-sm">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="h-12 md:h-16" aria-hidden />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-ink-900/10" />
    </section>
  );
}
