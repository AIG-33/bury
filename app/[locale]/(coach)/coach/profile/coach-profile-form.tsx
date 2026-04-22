"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Loader2, AlertCircle, CheckCircle2, Star } from "lucide-react";
import {
  saveMyCoachProfile,
  type CoachProfileSnapshot,
} from "./actions";

type Props = { initial: CoachProfileSnapshot };

export function CoachProfileForm({ initial }: Props) {
  const t = useTranslations("coachProfile");
  const router = useRouter();

  const [bio, setBio] = useState<string>(initial.coach_bio ?? "");
  const [rate, setRate] = useState<string>(
    initial.coach_hourly_rate_pln != null
      ? String(initial.coach_hourly_rate_pln)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function tErr(code: string) {
    try {
      return t(`errors.${code}` as never);
    } catch {
      return code;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveMyCoachProfile({
        coach_bio: bio,
        coach_hourly_rate_pln: rate === "" ? null : Number(rate),
      });
      if (!("ok" in res) || !res.ok) {
        const first = res.fieldErrors
          ? Object.values(res.fieldErrors)[0]?.[0]
          : null;
        setError(tErr(first ?? res.error));
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-semibold text-ink-900">
          {t("section.public_card")}
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          {t("rating_summary", {
            avg: initial.coach_avg_rating?.toFixed(2) ?? "—",
            count: initial.coach_reviews_count,
          })}
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              {t("field.bio")}
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t("placeholder.bio")}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-400 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-ink-400">
              {bio.length} / 2000
            </p>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              {t("field.rate")}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={10000}
                step={10}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="120"
                className="h-11 w-32 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-grass-400 focus:outline-none"
              />
              <span className="text-sm text-ink-500">{t("field.rate_currency")}</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">{t("hint.rate")}</p>
          </label>
        </div>

        <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
          {t("hint.location_via_slots")}
        </p>
      </section>

      {error && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white transition hover:bg-grass-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? t("saving") : t("save")}
        </button>
        {savedAt !== null && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-grass-700">
            <CheckCircle2 className="h-4 w-4" />
            {t("saved")}
          </span>
        )}
        {initial.coach_avg_rating != null && (
          <span className="ml-auto inline-flex items-center gap-1 text-sm text-ink-600">
            <Star className="h-4 w-4 fill-ball-400 text-ball-500" />
            {initial.coach_avg_rating.toFixed(2)}
          </span>
        )}
      </div>
    </form>
  );
}
