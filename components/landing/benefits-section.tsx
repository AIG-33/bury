"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import type { Route } from "next";
import { ArrowUpRight, type LucideIcon, Search, Sparkles, Star, Trophy } from "lucide-react";

const BENEFITS = ["rating", "find", "tournaments", "coaches"] as const;
type BenefitId = (typeof BENEFITS)[number];

const ICONS: Record<BenefitId, LucideIcon> = {
  rating: Sparkles,
  find: Search,
  tournaments: Trophy,
  coaches: Star,
};

type BenefitsSectionProps = {
  ratingHref: string;
  findHref: string;
  tournamentsHref: string;
  coachesHref: string;
};

const HREF_BY_ID = (props: BenefitsSectionProps): Record<BenefitId, string> => ({
  rating: props.ratingHref,
  find: props.findHref,
  tournaments: props.tournamentsHref,
  coaches: props.coachesHref,
});

// 4-up grid of concrete benefits. Replaces the old "Three pillars / one
// platform" copy because that headline didn't tell the visitor anything.
// Each card is one product benefit, one paragraph and one tag for scanability.
export function BenefitsSection(props: BenefitsSectionProps) {
  const t = useTranslations("landing.benefits");
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const hrefById = HREF_BY_ID(props);

  return (
    <section ref={ref} className="relative bg-white text-ink-900" aria-label={t("title")}>
      <div className="page-shell-wide max-w-[1280px] py-20 md:py-28">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 md:col-span-7">
            <p className="label-eyebrow">{t("eyebrow")}</p>
            <motion.h2
              className="mt-4 font-display font-bold leading-[0.98] tracking-tightest text-grass-900"
              style={{ fontSize: "clamp(32px, 4.4vw, 56px)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {t("title")}
            </motion.h2>
          </div>
          <div className="col-span-12 md:col-span-5">
            <p className="max-w-md text-[16px] leading-relaxed text-ink-600 md:text-[17px]">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2">
          {BENEFITS.map((id, i) => {
            const Icon = ICONS[id];
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.7,
                  delay: 0.08 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Link
                  href={hrefById[id] as Route}
                  className="ease-followthrough group flex h-full flex-col gap-5 rounded-xl3 border border-ink-200/70 bg-white p-7 shadow-[0_8px_30px_-18px_rgba(15,27,20,0.08)] transition-all duration-500 hover:-translate-y-0.5 hover:border-grass-300 hover:bg-grass-50 hover:shadow-[0_18px_44px_-18px_rgba(31,138,76,0.4)] md:p-9"
                >
                  <div className="flex items-start justify-between">
                    <span className="ease-followthrough inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-grass-50 text-grass-700 ring-1 ring-grass-200/80 transition-colors duration-500 group-hover:bg-grass-700 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-grass-700/80">
                      {t(`items.${id}.tag`)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-display text-[22px] font-bold leading-tight tracking-tight text-ink-900 md:text-[26px]">
                      {t(`items.${id}.title`)}
                    </h3>
                    <p className="text-[15.5px] leading-relaxed text-ink-600 md:text-base">
                      {t(`items.${id}.body`)}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center gap-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-grass-700">
                    <span className="ease-followthrough h-px w-6 bg-grass-700/40 transition-all duration-500 group-hover:w-10 group-hover:bg-grass-700" />
                    <ArrowUpRight className="ease-followthrough h-3.5 w-3.5 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
