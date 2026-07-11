"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import type { Route } from "next";
import { ArrowUpRight, type LucideIcon, Search, Sparkles, Star, Trophy } from "lucide-react";

// Display order — tournaments lead because tournament organisation is the
// flagship value of the platform; rating is a side benefit and ships last.
const BENEFITS = ["tournaments", "find", "coaches", "rating"] as const;
type BenefitId = (typeof BENEFITS)[number];

const ICONS: Record<BenefitId, LucideIcon> = {
  tournaments: Trophy,
  find: Search,
  coaches: Star,
  rating: Sparkles,
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
    <section ref={ref} className="relative text-ink-900" aria-label={t("title")}>
      <div className="page-shell !py-10 md:!py-14">
        <div className="max-w-2xl">
          <p className="label-eyebrow">{t("eyebrow")}</p>
          <motion.h2
            className="section-title mt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {t("title")}
          </motion.h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{t("subtitle")}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {BENEFITS.map((id, i) => {
            const Icon = ICONS[id];
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.05 + i * 0.05, ease: "easeOut" }}
              >
                <Link
                  href={hrefById[id] as Route}
                  className="lift-on-hover group flex h-full flex-col gap-4 rounded-xl2 border border-[rgba(20,60,30,0.07)] bg-white p-5 shadow-card md:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="icon-preview transition-colors duration-200 group-hover:bg-pt-primary group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="label-eyebrow text-right text-grass-600">
                      {t(`items.${id}.tag`)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-[17px] font-extrabold leading-snug text-ink-900">
                      {t(`items.${id}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-ink-500">
                      {t(`items.${id}.body`)}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center gap-2 text-grass-600">
                    <span className="h-px w-6 bg-grass-600/40 transition-all duration-200 group-hover:w-10 group-hover:bg-grass-600" />
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
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
