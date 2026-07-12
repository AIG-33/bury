"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Route } from "next";
import { ArrowRight, Trophy } from "lucide-react";

type Props = {
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
  /** Public tournaments currently in progress — drives the pulsing badge. */
  liveCount: number;
};

const EASE = [0.22, 1, 0.36, 1] as const;

// Dark hero per redesign spec §4.1: brand gradient + lime corner glow,
// slogan, lime + glass CTAs, pulsing "live now" badge, 3 hero numbers.
export function LandingHero({
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  liveCount,
}: Props) {
  const t = useTranslations("landing.hero");
  const tt = useTranslations("landing.trust");

  const trust = [
    { key: "cities", value: tt("items.cities.value"), label: tt("items.cities.label") },
    { key: "venues", value: tt("items.venues.value"), label: tt("items.venues.label") },
    { key: "formats", value: tt("items.formats.value"), label: tt("items.formats.label") },
  ] as const;

  return (
    <section className="page-shell !pb-0 !pt-4 md:!pt-6">
      <motion.div
        className="hero-dark px-5 py-10 sm:px-8 md:px-12 md:py-14"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-eyebrow-dark">{t("eyebrow")}</span>
            {liveCount > 0 && (
              <span className="glass-on-dark inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11.5px] font-bold text-ball-300">
                <span className="pulse-dot" />
                {t("live_badge", { n: liveCount })}
              </span>
            )}
          </div>

          <h1
            className="mt-5 max-w-3xl font-display font-extrabold leading-[1.08] text-white"
            style={{ fontSize: "clamp(30px, 4.4vw, 44px)", letterSpacing: "-1px" }}
          >
            <span className="block">{t("title_line_1")}</span>
            <span className="block">{t("title_line_2")}</span>
            <span className="block text-ball-400">{t("title_line_3")}</span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">
            {t("subtitle")}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={primaryCtaHref as Route}
              className="btn btn-lg btn-accent group w-full sm:w-auto"
            >
              <span>{primaryCtaLabel}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={secondaryCtaHref as Route}
              className="btn btn-lg glass-on-dark w-full font-bold hover:-translate-y-0.5 hover:bg-white/15 sm:w-auto"
            >
              <Trophy className="h-4 w-4 text-ball-400" />
              {t("cta_secondary")}
            </Link>
          </div>

          {/* Hero numbers — single column on mobile per spec breakpoints. */}
          <ul className="mt-10 grid grid-cols-1 gap-4 border-t border-white/15 pt-6 sm:grid-cols-3 sm:gap-6">
            {trust.map((item) => (
              <li key={item.key} className="flex flex-col gap-1">
                <span className="font-mono text-3xl font-bold leading-none text-white tabular-nums md:text-4xl">
                  {item.value}
                </span>
                <span className="text-[13px] leading-snug text-white/65">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
