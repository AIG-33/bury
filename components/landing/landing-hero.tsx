"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { LivingBall } from "./living-ball";
import { MagneticCTA } from "./magnetic-cta";
import { ScrollCue } from "./scroll-cue";
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
    <section className="relative isolate overflow-hidden bg-atp-night text-ink-50 film-grain">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 aura-night opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-atp-night/40 via-transparent to-atp-night" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pt-24 md:px-12 md:pt-28">
        {/* Eyebrow row */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <span className="label-eyebrow">{t("hero.eyebrow")}</span>
          <span className="label-eyebrow hidden md:inline">
            {t("meta.city")} · {t("meta.est")}
          </span>
        </motion.div>

        {/* Stage */}
        <div className="relative mt-8 grid flex-1 grid-cols-12 items-center gap-6 md:mt-10">
          {/* Living ball — centred on mobile, right on desktop */}
          <div className="col-span-12 md:col-span-7 md:col-start-6">
            <div className="relative mx-auto aspect-square w-[78vw] max-w-[640px] md:w-full">
              <LivingBall className="absolute inset-0" />
            </div>
          </div>

          {/* Editorial type composition — overlaid on top of the ball stage */}
          <div className="pointer-events-none absolute inset-0 col-span-12 flex flex-col justify-end pb-16 md:pb-20">
            <div className="relative">
              <motion.h1
                className="font-display font-extrabold leading-[0.84] tracking-tightest text-ink-50"
                style={{ fontSize: "clamp(64px, 13vw, 220px)" }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="block font-semibold text-ink-50/90">
                  {t("hero.first_name")}
                </span>
                <span className="block font-extrabold">
                  {t("hero.last_name")}
                </span>
              </motion.h1>
              <motion.p
                className="mt-6 max-w-md font-mono text-[12px] uppercase leading-relaxed tracking-[0.2em] text-silver md:max-w-lg"
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
            <div className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.22em] text-silver">
              <span className="text-ink-50">{t("meta.tagline_top")}</span>
            </div>
          </div>
          <div className="col-span-12 flex flex-wrap items-center gap-3 md:col-span-5 md:justify-center">
            <MagneticCTA href={primaryCtaHref as Route} variant="fill">
              {primaryCtaLabel}
            </MagneticCTA>
            <MagneticCTA href={secondaryCtaHref as Route} variant="ghost">
              {secondaryCtaLabel}
            </MagneticCTA>
          </div>
          <div className="col-span-12 flex md:col-span-3 md:justify-end">
            <ScrollCue label={t("hero.scroll")} index="01 / 02" />
          </div>
        </motion.div>
      </div>

      {/* Bottom hairline divider */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
    </section>
  );
}
