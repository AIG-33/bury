"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { LivingBall } from "./living-ball";
import { MagneticCTA } from "./magnetic-cta";
import { ScrollCue } from "./scroll-cue";
import { LightTennisBackdrop } from "./light-tennis-backdrop";
import type { Route } from "next";

type Props = {
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
  secondaryCtaLabel: string;
};

export function LandingHero({
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaLabel,
}: Props) {
  const t = useTranslations("landing.v2");

  return (
    <section className="relative isolate overflow-hidden bg-grass-50 text-ink-900 film-grain">
      {/* Abstract tennis backdrop — soft green wash + glowing yellow ball halo */}
      <LightTennisBackdrop className="-z-10" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pt-24 md:px-12 md:pt-28">
        {/* Eyebrow row — now only place / est */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <span className="label-eyebrow">{t("meta.tagline_top")}</span>
          <span className="label-eyebrow hidden md:inline">
            {t("meta.city")} · {t("meta.est")}
          </span>
        </motion.div>

        {/* Stage */}
        <div className="relative mt-8 grid flex-1 grid-cols-12 items-center gap-6 md:mt-10">
          {/* Living ball — centred on mobile, right on desktop */}
          <div className="col-span-12 md:col-span-7 md:col-start-6">
            <div className="relative mx-auto aspect-square w-[72vw] max-w-[600px] md:w-full">
              <LivingBall className="absolute inset-0" />
            </div>
          </div>

          {/* Type composition overlaid on top of the ball stage */}
          <div className="pointer-events-none absolute inset-0 col-span-12 flex flex-col justify-end pb-16 md:pb-20">
            <div className="relative">
              <motion.h1
                className="font-display leading-[0.84] tracking-tightest text-ink-900"
                style={{ fontSize: "clamp(64px, 13vw, 220px)" }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="block font-semibold text-ink-700">
                  {t("hero.first_name")}
                </span>
                <span className="block font-extrabold text-grass-900">
                  {t("hero.last_name")}
                </span>
              </motion.h1>
              <motion.p
                className="mt-6 max-w-md font-mono text-[12px] uppercase leading-relaxed tracking-[0.2em] text-ink-600 md:max-w-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {t("hero.tagline")}
              </motion.p>
            </div>
          </div>
        </div>

        {/* Bottom rail: tagline + CTAs + scroll cue */}
        <motion.div
          className="relative z-10 mt-10 grid grid-cols-12 items-end gap-6 pb-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="col-span-12 md:col-span-4">
            <div className="hairline mb-3 max-w-[180px]" />
            <div className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.22em] text-ink-700">
              {t("meta.city")} · {t("meta.est")}
            </div>
          </div>
          <div className="col-span-12 flex flex-wrap items-center gap-3 md:col-span-5 md:justify-center">
            <MagneticCTA href={primaryCtaHref as Route} variant="solid">
              {primaryCtaLabel}
            </MagneticCTA>
            <MagneticCTA href={secondaryCtaHref as Route} variant="outline">
              {secondaryCtaLabel}
            </MagneticCTA>
          </div>
          <div className="col-span-12 flex md:col-span-3 md:justify-end">
            <ScrollCue label={t("hero.scroll")} index="01 / 02" theme="light" />
          </div>
        </motion.div>
      </div>

      {/* Bottom hairline divider */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-ink-900/10" />
    </section>
  );
}
