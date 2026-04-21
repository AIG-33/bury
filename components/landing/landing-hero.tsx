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
};

export function LandingHero({ primaryCtaHref, primaryCtaLabel }: Props) {
  const t = useTranslations("landing.v2");

  return (
    <section className="relative isolate overflow-hidden bg-grass-50 text-ink-900 film-grain">
      {/* Abstract tennis backdrop — soft green wash + glowing yellow ball halo */}
      <LightTennisBackdrop className="-z-10" />

      <div className="relative mx-auto flex min-h-[78svh] max-w-[1440px] flex-col px-6 pt-20 md:min-h-[84svh] md:px-12 md:pt-24">
        {/* Eyebrow row */}
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
        <div className="relative mt-4 grid flex-1 grid-cols-12 items-center gap-6 md:mt-6">
          {/* Living ball — pushed off the right edge on mobile so the
               headline stays fully readable; centred-right on desktop. */}
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <div className="relative ml-auto -mr-[14vw] aspect-square w-[44vw] max-w-[260px] md:mx-auto md:mr-0 md:w-[26vw] md:max-w-none">
              <LivingBall className="absolute inset-0" />
            </div>
          </div>

          {/* Type composition overlaid on top of the ball stage */}
          <div className="pointer-events-none absolute inset-0 col-span-12 flex flex-col justify-end pb-8 md:pb-10">
            <div className="relative">
              <motion.h1
                className="font-display leading-[0.86] tracking-tightest text-ink-900"
                style={{ fontSize: "clamp(44px, 7.4vw, 120px)" }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="block font-semibold text-ink-700">
                  Alex Bury
                </span>
                <span className="block font-extrabold text-grass-900">
                  Tennis Club
                </span>
              </motion.h1>
              <motion.p
                className="mt-5 max-w-md font-mono text-[14px] uppercase leading-relaxed tracking-[0.2em] text-ink-700 md:max-w-lg md:text-[15px]"
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

        {/* Bottom rail: meta + big primary CTA + scroll cue */}
        <motion.div
          className="relative z-10 mt-6 grid grid-cols-12 items-end gap-6 pb-7 md:mt-8 md:pb-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="col-span-12 md:col-span-4">
            <div className="hairline mb-3 max-w-[180px]" />
            <div className="font-mono text-[12.5px] uppercase leading-relaxed tracking-[0.22em] text-ink-700">
              {t("meta.city")} · {t("meta.est")}
            </div>
          </div>

          <div className="col-span-12 flex md:col-span-5 md:justify-center">
            <div className="relative">
              {/* Soft halo behind the CTA so it pops on the light backdrop */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-grass-500/15 blur-2xl"
              />
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 3.6,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                <MagneticCTA
                  href={primaryCtaHref as Route}
                  variant="solid"
                  size="lg"
                >
                  {primaryCtaLabel}
                </MagneticCTA>
              </motion.div>
            </div>
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
