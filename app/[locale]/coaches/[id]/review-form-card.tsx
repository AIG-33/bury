"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Star, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReviewEligibility } from "@/lib/reviews/eligibility";
import { submitReview } from "../actions";

const CATEGORY_KEYS = ["technique", "communication", "punctuality", "vibe"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

type Props = {
  coachId: string;
  eligibility: ReviewEligibility;
};

export function ReviewFormCard({ coachId, eligibility }: Props) {
  const t = useTranslations("coachesPublic.detail.review_form");
  const router = useRouter();
  const [stars, setStars] = useState<number>(0);
  const [text, setText] = useState("");
  const [categories, setCategories] = useState<Record<CategoryKey, number>>({
    technique: 0,
    communication: 0,
    punctuality: 0,
    vibe: 0,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function tErr(code: string) {
    try {
      return t(`errors.${code}` as never);
    } catch {
      return code;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      setError(tErr("missing_stars"));
      return;
    }
    setError(null);
    setSuccess(false);

    const cats: Record<string, number> = {};
    for (const k of CATEGORY_KEYS) {
      if (categories[k] > 0) cats[k] = categories[k];
    }

    startTransition(async () => {
      const res = await submitReview({
        coach_id: coachId,
        source_type: eligibility.source_type,
        // 'open' reviews carry no source row.
        source_id: eligibility.source_type === "open" ? null : eligibility.source_id,
        stars,
        text: text.trim() || null,
        categories: Object.keys(cats).length > 0 ? cats : null,
      });
      if (!res.ok) {
        setError(tErr(res.error));
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  const heading = eligibility.has_existing_review
    ? t("heading_update")
    : t("heading_create");
  const submitLabel = eligibility.has_existing_review
    ? t("submit_update")
    : t("submit_create");

  return (
    <section className="rounded-xl2 border border-grass-100 bg-grass-50/40 p-5 shadow-card">
      <h2 className="font-display text-base font-semibold text-grass-800">
        {heading}
      </h2>
      <p className="mt-1 text-xs text-ink-600">
        {t(`source_hint.${eligibility.source_type}`)}
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-ink-700">{t("stars_label")}</p>
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                aria-label={t("stars_aria", { n })}
                className="rounded p-1 transition hover:bg-white/70"
              >
                <Star
                  className={
                    n <= stars
                      ? "h-7 w-7 fill-ball-400 text-ball-500"
                      : "h-7 w-7 text-ink-300"
                  }
                />
              </button>
            ))}
          </div>
        </div>

        <details className="rounded-lg border border-white bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-700">
            {t("categories_label")}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORY_KEYS.map((k) => (
              <div key={k}>
                <p className="text-xs text-ink-600">{t(`categories.${k}`)}</p>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setCategories((prev) => ({ ...prev, [k]: n }))
                      }
                      className="rounded p-0.5 transition hover:bg-grass-50"
                      aria-label={t("stars_aria", { n })}
                    >
                      <Star
                        className={
                          n <= categories[k]
                            ? "h-4 w-4 fill-ball-400 text-ball-500"
                            : "h-4 w-4 text-ink-300"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        <div>
          <label
            htmlFor="review-text"
            className="text-sm font-medium text-ink-700"
          >
            {t("text_label")}
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={t("text_placeholder")}
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-400 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-ink-400">
            {text.length} / 1000
          </p>
        </div>

        {error && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
        {success && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-grass-100 px-3 py-2 text-sm text-grass-800">
            <CheckCircle2 className="h-4 w-4" />
            {t("success")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600 disabled:opacity-60"
        >
          {pending ? t("submitting") : submitLabel}
        </button>
      </form>
    </section>
  );
}
