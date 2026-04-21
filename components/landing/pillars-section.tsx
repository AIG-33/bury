"use client";

import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { useRef, type ReactElement } from "react";
import Link from "next/link";
import type { Route } from "next";

const PILLARS = ["rating", "find", "tournaments"] as const;
type PillarId = (typeof PILLARS)[number];

type PillarsSectionProps = {
  ratingHref: string;
  findHref: string;
  tournamentsHref: string;
};

const ICONS: Record<PillarId, ReactElement> = {
  rating: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-full w-full"
    >
      <rect x="5" y="7" width="22" height="20" rx="2" />
      <path d="M11 4 V10 M21 4 V10" />
      <path d="M5 13 H27" opacity="0.5" />
      <path d="M11 20 L14.5 23.5 L21 17" />
    </svg>
  ),
  find: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-full w-full"
    >
      <circle cx="14" cy="14" r="8" />
      <path d="M20 20 L27 27" />
      <circle cx="14" cy="14" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  tournaments: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-full w-full"
    >
      <path d="M5 6 H11 V12 H17 V18 H23 V24 H29" />
      <path d="M5 14 H11 V20 H17 V26" opacity="0.5" />
    </svg>
  ),
};

export function PillarsSection({
  ratingHref,
  findHref,
  tournamentsHref,
}: PillarsSectionProps) {
  const t = useTranslations("landing.v2.pillars");
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-15%" });

  const hrefById: Record<PillarId, string> = {
    rating: ratingHref,
    find: findHref,
    tournaments: tournamentsHref,
  };

  return (
    <section
      ref={sectionRef}
      className="relative bg-grass-50 text-ink-900 film-grain"
      aria-label="Platform pillars"
    >
      {/* Soft separator wash from hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 h-24 bg-gradient-to-b from-grass-50/0 via-grass-50/60 to-grass-50"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 pb-32 pt-20 md:px-12 md:pb-40 md:pt-28">
        {/* Section header */}
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 md:col-span-7">
            <p className="label-eyebrow">{t("section_label")}</p>
            <motion.h2
              className="mt-5 font-display font-bold leading-[0.94] tracking-tightest text-grass-900"
              style={{ fontSize: "clamp(40px, 6vw, 96px)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {t("title")}
            </motion.h2>
          </div>
          <div className="col-span-12 md:col-span-5">
            <p className="max-w-md text-lg leading-relaxed text-ink-600 md:text-xl">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="hairline my-12 md:my-16" />

        {/* Pillars grid */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl3 border border-ink-200 bg-ink-200 md:grid-cols-3">
          {PILLARS.map((id, i) => (
            <PillarCard
              key={id}
              id={id}
              href={hrefById[id]}
              index={t(`items.${id}.index`)}
              name={t(`items.${id}.name`)}
              body={t(`items.${id}.body`)}
              statLabel={t(`items.${id}.stat_label`)}
              statValue={t(`items.${id}.stat_value`)}
              cta={t(`items.${id}.cta`)}
              delay={0.1 + i * 0.12}
              inView={inView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

type PillarCardProps = {
  id: PillarId;
  href: string;
  index: string;
  name: string;
  body: string;
  statLabel: string;
  statValue: string;
  cta: string;
  delay: number;
  inView: boolean;
};

function PillarCard({
  id,
  href,
  index,
  name,
  body,
  statLabel,
  statValue,
  cta,
  delay,
  inView,
}: PillarCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex min-h-[460px] flex-col justify-between bg-white p-8 transition-colors duration-500 ease-followthrough hover:bg-grass-50 md:p-10"
    >
      {/* Whole card is a link — overlay covers the article so any click navigates */}
      <Link
        href={href as Route}
        aria-label={`${name} — ${cta}`}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grass-700"
      ></Link>
      {/* Top: index + icon */}
      <div className="flex items-start justify-between">
        <span className="font-mono text-[12.5px] uppercase tracking-[0.22em] text-ink-500">
          {index}
        </span>
        <div className="h-14 w-14 text-ink-400 transition-colors duration-500 ease-followthrough group-hover:text-grass-700 md:h-16 md:w-16">
          {ICONS[id]}
        </div>
      </div>

      {/* Middle: title + body */}
      <div className="mt-12">
        <h3
          className="font-display font-bold leading-[0.95] tracking-tightest text-ink-900"
          style={{ fontSize: "clamp(32px, 3vw, 46px)" }}
        >
          {name}
        </h3>
        <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-ink-600">
          {body}
        </p>
      </div>

      {/* Bottom: stat */}
      <div className="mt-10 flex items-end justify-between border-t border-ink-200 pt-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
            {statLabel}
          </p>
          <p className="mt-1 font-display text-3xl font-bold tabular text-ink-900">
            {statValue}
          </p>
        </div>
        <span
          aria-hidden
          className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-700 transition-colors duration-500 ease-followthrough group-hover:text-grass-700"
        >
          <span className="hidden sm:inline">{cta}</span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-300 transition-all duration-500 ease-followthrough group-hover:translate-x-0.5 group-hover:border-grass-700">
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M2 8h12M9 3l5 5-5 5" />
            </svg>
          </span>
        </span>
      </div>

      {/* Hover accent: grass hairline along top edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-grass-700 transition-transform duration-700 ease-followthrough group-hover:scale-x-100"
      />
    </motion.article>
  );
}
