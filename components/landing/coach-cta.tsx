"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Users2 } from "lucide-react";

type Props = {
  ctaHref: string;
};

// Narrow strip aimed at coaches/clubs. Lives between "How it works" and
// "Final CTA" so the player audience reaches the bottom regardless, while
// coaches still see a clear, separate entry point.
export function CoachCta({ ctaHref }: Props) {
  const t = useTranslations("landing.coach_cta");

  return (
    <section className="relative" aria-label={t("title")}>
      <div className="page-shell !py-6 md:!py-8">
        <div className="hero-dark rounded-xl3 p-6 md:p-10">
          <div className="relative grid grid-cols-12 items-center gap-6">
            <div className="col-span-12 md:col-span-8">
              <p className="label-eyebrow-dark text-ball-300">{t("eyebrow")}</p>
              <h2
                className="mt-3 font-display font-extrabold leading-tight text-white"
                style={{ fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.5px" }}
              >
                {t("title")}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 md:text-base">
                {t("body")}
              </p>
            </div>

            <div className="col-span-12 md:col-span-4 md:flex md:justify-end">
              <Link
                href={ctaHref as Route}
                className="btn btn-lg btn-accent group w-full sm:w-auto"
              >
                <Users2 className="h-4 w-4" />
                <span>{t("cta")}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
