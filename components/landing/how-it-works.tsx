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
    <section ref={ref} className="relative text-ink-900" aria-label={t("title")}>
      <div className="page-shell !py-10 md:!py-14">
        <p className="label-eyebrow">{t("eyebrow")}</p>
        <motion.h2
          className="section-title mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {t("title")}
        </motion.h2>

        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((id, i) => {
            const Icon = ICONS[id];
            return (
              <motion.li
                key={id}
                className="flex flex-col gap-4 rounded-xl2 border border-[rgba(20,60,30,0.07)] bg-white p-5 shadow-card"
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.05 + i * 0.05, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between">
                  {/* Dark step icon per spec §4.1. */}
                  <span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-[14px] bg-pt-hero text-ball-400"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-ink-400 tabular-nums">
                    {t(`steps.${id}.n`)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display text-[16px] font-extrabold leading-snug text-ink-900">
                    {t(`steps.${id}.title`)}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-ink-500">
                    {t(`steps.${id}.body`)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
