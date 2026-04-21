"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Star, Eye, EyeOff, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  moderateReview,
  type AdminReviewRow,
} from "@/app/[locale]/coaches/actions";

type Filter = "all" | "flagged";

type Props = {
  initialRows: AdminReviewRow[];
  initialFilter: Filter;
};

export function ReviewsModerationClient({ initialRows, initialFilter }: Props) {
  const t = useTranslations("adminReviews");
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeFilter(next: Filter) {
    setFilter(next);
    const search = next === "flagged" ? "?filter=flagged" : "";
    router.replace(`${pathname}${search}` as never);
  }

  function action(id: string, op: "publish" | "hide" | "remove") {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await moderateReview({ review_id: id, action: op });
      setBusyId(null);
      if (!("ok" in res) || !res.ok) {
        setError(res.error || "error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => changeFilter("all")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium " +
            (filter === "all"
              ? "bg-clay-500 text-white"
              : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50")
          }
        >
          {t("filter.all")}
        </button>
        <button
          type="button"
          onClick={() => changeFilter("flagged")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium " +
            (filter === "flagged"
              ? "bg-clay-500 text-white"
              : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50")
          }
        >
          {t("filter.flagged")}
        </button>
      </div>

      {error && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {initialRows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-ink-900">
                {r.reviewer_name ?? t("anonymous")}
              </span>
              <span className="text-ink-400">→</span>
              <span className="font-medium text-ink-900">
                {r.target_coach_name ?? "—"}
              </span>
              <span className="ml-auto inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={
                      i < r.stars
                        ? "h-4 w-4 fill-ball-400 text-ball-500"
                        : "h-4 w-4 text-ink-200"
                    }
                  />
                ))}
              </span>
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                  (r.status === "published"
                    ? "bg-grass-100 text-grass-800"
                    : r.status === "flagged"
                      ? "bg-ball-100 text-clay-700"
                      : r.status === "hidden"
                        ? "bg-ink-100 text-ink-600"
                        : "bg-clay-100 text-clay-700")
                }
              >
                {t(`status.${r.status}`)}
              </span>
            </div>

            <div className="mt-1 text-xs text-ink-500">
              {new Date(r.created_at).toLocaleString()} ·{" "}
              {t(`source.${r.source_type}`)}
            </div>

            {r.text && (
              <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
                {r.text}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending && busyId === r.id}
                onClick={() => action(r.id, "publish")}
                className="inline-flex items-center gap-1 rounded-lg bg-grass-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-grass-600 disabled:opacity-60"
              >
                <Eye className="h-3.5 w-3.5" />
                {t("actions.publish")}
              </button>
              <button
                type="button"
                disabled={pending && busyId === r.id}
                onClick={() => action(r.id, "hide")}
                className="inline-flex items-center gap-1 rounded-lg bg-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-300 disabled:opacity-60"
              >
                <EyeOff className="h-3.5 w-3.5" />
                {t("actions.hide")}
              </button>
              <button
                type="button"
                disabled={pending && busyId === r.id}
                onClick={() => {
                  if (confirm(t("confirm_remove"))) action(r.id, "remove");
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-clay-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("actions.remove")}
              </button>
              {!pending && busyId === null && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("ready")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
