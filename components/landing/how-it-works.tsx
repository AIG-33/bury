"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { motion, useInView } from "framer-motion";
import { LogIn, ListChecks, CalendarCheck, LineChart, type LucideIcon } from "lucide-react";

const STEPS = ["register", "quiz", "play", "elo"] as const;
type StepId = (typeof STEPS)[number];

const ICONS: Record<StepId, LucideIcon> = {
  register: LogIn,
  quiz: ListChecks,
  play: CalendarCheck,
  elo: LineChart,
};

// Four-step numbered explainer that answers "what happens after I register?"
// Visual rhythm: a faint connector line on desktop ties the steps together,
// large numbers and an icon make each step instantly scannable.
export function HowItWorks() {
  const t = useTranslations("landing.how");
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section ref={ref} className="relative bg-grass-50 text-ink-900" aria-label={t("title")}>
      <div className="page-shell-wide max-w-[1280px] py-20 md:py-28">
        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 md:col-span-8">
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
        </div>

        <div className="relative mt-12 md:mt-16">
          {/* Faint horizontal connector on desktop */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[44px] hidden h-px bg-gradient-to-r from-grass-200 via-grass-300 to-transparent md:block"
          />

          <ol className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-6">
            {STEPS.map((id, i) => {
              const Icon = ICONS[id];
              return (
                <motion.li
                  key={id}
                  className="relative flex flex-col gap-4"
                  initial={{ opacity: 0, y: 18 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.7,
                    delay: 0.1 + i * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="relative flex items-center gap-3">
                    <span
                      aria-hidden
                      className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full bg-white text-grass-700 shadow-[0_18px_40px_-22px_rgba(31,138,76,0.45)] ring-1 ring-grass-200/80"
                    >
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-grass-700/70">
                      {t(`steps.${id}.n`)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-[20px] font-bold leading-tight tracking-tight text-ink-900 md:text-[22px]">
                      {t(`steps.${id}.title`)}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-ink-600">
                      {t(`steps.${id}.body`)}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
