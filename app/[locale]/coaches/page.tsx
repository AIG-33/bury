import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Award, MapPin, Star, Trophy, Map as MapIcon } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import {
  loadCoaches,
  loadVenueOptions,
  loadDistrictOptionsForCoaches,
} from "./actions";
import {
  rankCoaches,
  sortCoaches,
  podium,
  MIN_REVIEWS_FOR_BADGE,
  type SortKey,
} from "@/lib/coaches/leaderboard";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    sort?: string;
    verified?: string;
    venue?: string;
    district?: string;
  }>;
};

const SORT_KEYS: SortKey[] = ["weighted", "raw", "popular"];

function buildHref(
  next: Partial<{
    sort: string;
    verified: "1" | "0";
    venue: string;
    district: string;
  }>,
  current: {
    sort: string;
    verified: boolean;
    venueId: string;
    districtId: string;
  },
) {
  const sp = new URLSearchParams();
  const sort = next.sort ?? current.sort;
  if (sort && sort !== "weighted") sp.set("sort", sort);
  const verifiedNext =
    next.verified !== undefined ? next.verified === "1" : current.verified;
  if (verifiedNext) sp.set("verified", "1");
  const venue = next.venue !== undefined ? next.venue : current.venueId;
  if (venue) sp.set("venue", venue);
  const district = next.district !== undefined ? next.district : current.districtId;
  if (district) sp.set("district", district);
  const qs = sp.toString();
  return `/coaches${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "coachesPublic" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/coaches`,
      languages: { pl: "/pl/coaches", en: "/en/coaches", ru: "/ru/coaches" },
    },
  };
}

export default async function CoachesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("coachesPublic");

  const sortKey: SortKey = SORT_KEYS.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : "weighted";
  const verifiedOnly = sp.verified === "1";
  const venueId = sp.venue ?? "";
  const districtId = sp.district ?? "";

  const [rawCoaches, venues, districts] = await Promise.all([
    loadCoaches({
      venueId: venueId || null,
      districtId: venueId ? null : districtId || null,
    }),
    loadVenueOptions(),
    loadDistrictOptionsForCoaches(),
  ]);
  const ranked = rankCoaches(rawCoaches);
  const top3 = podium(ranked, 3);
  const top3Ids = new Set(top3.map((p) => p.id));

  const filtered = verifiedOnly ? ranked.filter((r) => r.qualifies) : ranked;
  const sorted = sortCoaches(filtered, sortKey);
  const coachesById = new Map(rawCoaches.map((c) => [c.id, c] as const));

  const filterState = {
    sort: sortKey,
    verified: verifiedOnly,
    venueId,
    districtId,
  };
  const hasFilter = Boolean(venueId || districtId || verifiedOnly);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">
            {t("title")}
          </h1>
          <p className="mt-1 text-ink-600">{t("subtitle")}</p>
        </div>
        <Link
          href="/coaches/map"
          className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white transition hover:bg-grass-600"
        >
          <MapIcon className="h-4 w-4" />
          {t("view_map")}
        </Link>
      </header>

      <HelpPanel
        pageId="coaches-public"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {top3.length > 0 && (
        <section className="rounded-xl2 border border-ball-200 bg-gradient-to-br from-ball-50 to-white p-5 shadow-card">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink-900">
            <Trophy className="h-5 w-5 text-ball-500" />
            {t("podium.title")}
          </h2>
          <p className="mt-1 text-xs text-ink-600">
            {t("podium.subtitle", { min: MIN_REVIEWS_FOR_BADGE })}
          </p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {top3.map((p, idx) => {
              const c = coachesById.get(p.id);
              if (!c) return null;
              return (
                <li
                  key={p.id}
                  className={
                    "rounded-xl border bg-white p-3 " +
                    (idx === 0
                      ? "border-ball-400 ring-2 ring-ball-200"
                      : "border-ink-100")
                  }
                >
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/coaches/${c.id}` as any}
                    className="flex items-start gap-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-800">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatar_url}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <Award className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold text-ink-900">
                        <span className="font-mono text-xs text-ball-700">
                          #{idx + 1}
                        </span>
                        <span className="truncate">{c.display_name ?? "—"}</span>
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
                        <Star className="h-3 w-3 fill-ball-400 text-ball-500" />
                        <span className="font-mono font-semibold">
                          {p.weighted_score!.toFixed(2)}
                        </span>
                        <span className="text-ink-400">·</span>
                        <span>
                          {t("reviews_count", {
                            count: p.coach_reviews_count,
                          })}
                        </span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="space-y-3 rounded-xl2 border border-ink-100 bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            {t("controls.sort_by")}
          </span>
          {SORT_KEYS.map((k) => (
            <Link
              key={k}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={buildHref({ sort: k }, filterState) as any}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                (sortKey === k
                  ? "bg-grass-500 text-white"
                  : "bg-grass-50 text-grass-800 hover:bg-grass-100")
              }
            >
              {t(`controls.sort.${k}`)}
            </Link>
          ))}
          <span className="ml-auto text-xs text-ink-500">
            {t("controls.verified_only")}
          </span>
          <Link
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            href={
              buildHref(
                { verified: verifiedOnly ? "0" : "1" },
                filterState,
              ) as any
            }
            className={
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
              (verifiedOnly ? "bg-grass-500" : "bg-ink-200")
            }
            aria-pressed={verifiedOnly}
          >
            <span
              className={
                "inline-block h-5 w-5 rounded-full bg-white shadow transition " +
                (verifiedOnly ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </Link>
        </div>

        <form
          action={`/${locale}/coaches`}
          method="get"
          className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {t("controls.venue")}
            </span>
            <select
              name="venue"
              defaultValue={venueId}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("controls.any_venue")}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.district_name ? ` · ${v.district_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {t("controls.district")}
            </span>
            <select
              name="district"
              defaultValue={districtId}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500 disabled:bg-ink-50 disabled:text-ink-400"
              disabled={Boolean(venueId)}
            >
              <option value="">{t("controls.any_district")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="sort" value={sortKey} />
          {verifiedOnly && (
            <input type="hidden" name="verified" value="1" />
          )}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600"
            >
              {t("controls.apply")}
            </button>
            {hasFilter && (
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={"/coaches" as any}
                className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {t("controls.reset")}
              </Link>
            )}
          </div>
        </form>
      </div>

      {sorted.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title={t("empty_filter_title")}
            description={t("empty_filter_body")}
            ctaLabel={t("controls.reset")}
            ctaHref={`/${locale}/coaches`}
          />
        ) : (
          <EmptyState title={t("empty_title")} description={t("empty_body")} />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => {
            const c = coachesById.get(p.id);
            if (!c) return null;
            const isPodium = top3Ids.has(c.id);
            return (
              <li
                key={c.id}
                className={
                  "rounded-xl2 border bg-white p-4 shadow-card transition hover:shadow-ace " +
                  (isPodium ? "border-ball-200" : "border-ink-100")
                }
              >
                <Link
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  href={`/coaches/${c.id}` as any}
                  className="block"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Award className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold text-ink-900">
                        {c.display_name ?? "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        {c.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {c.city}
                          </span>
                        )}
                        {p.qualifies && (
                          <span className="inline-flex items-center rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold text-grass-700">
                            {t("badges.verified")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                    {c.coach_avg_rating != null ? (
                      <>
                        <Star className="h-4 w-4 fill-ball-400 text-ball-500" />
                        <span className="font-mono font-semibold">
                          {c.coach_avg_rating.toFixed(2)}
                        </span>
                        <span className="text-xs text-ink-500">
                          {t("reviews_count", {
                            count: c.coach_reviews_count,
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-500">
                        {t("no_reviews_yet")}
                      </span>
                    )}
                  </div>

                  {c.coach_bio && (
                    <p className="mt-2 line-clamp-3 text-sm text-ink-600">
                      {c.coach_bio}
                    </p>
                  )}

                  {c.coach_hourly_rate_pln != null && (
                    <p className="mt-2 text-xs text-ink-500">
                      {t("hourly_rate", {
                        amount: c.coach_hourly_rate_pln,
                      })}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
