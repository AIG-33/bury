import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Building2, CalendarClock, MapPin, Search, Trophy, Users } from "lucide-react";
import { LevelBadge } from "@/components/rating/level-badge";
import { RatingDisplay } from "@/components/rating/rating-display";
import { Surface } from "@/components/ui/surface";
import { loadOpenMatch } from "../actions";
import { ApplyControls } from "./apply-controls";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const detail = await loadOpenMatch(id);
  if (!detail) return { title: "—", robots: { index: false } };
  const t = await getTranslations({ locale, namespace: "openMatches" });
  return {
    title: `${t("title")} · ${detail.match.creator_name ?? "—"}`,
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/open-matches/${id}`,
      languages: {
        ru: `/ru/open-matches/${id}`,
        en: `/en/open-matches/${id}`,
      },
    },
  };
}

export default async function OpenMatchDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const detail = await loadOpenMatch(id);
  if (!detail) notFound();

  const t = await getTranslations("openMatches");
  const tDetail = await getTranslations("openMatches.detail");
  const tLevels = await getTranslations("levels");

  const { match, isCreator, myApplication, applications } = detail;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" });

  let banner: { tone: "ink" | "clay"; text: string } | null = null;
  if (match.status === "filled") banner = { tone: "ink", text: tDetail("filled_banner") };
  else if (match.status === "cancelled") banner = { tone: "clay", text: tDetail("cancelled_banner") };
  else if (match.status === "expired") banner = { tone: "ink", text: tDetail("expired_banner") };

  return (
    <div className="page-shell space-y-6">
      <Link
        href="/open-matches"
        className="inline-flex items-center gap-1 text-sm text-ink-600 transition hover:text-grass-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {tDetail("back")}
      </Link>

      {banner && (
        <div
          className={
            "rounded-lg border px-3 py-2 text-sm " +
            (banner.tone === "clay"
              ? "border-clay-200 bg-clay-50 text-clay-800"
              : "border-ink-200 bg-ink-50 text-ink-700")
          }
        >
          {banner.text}
        </div>
      )}

      {/* Looking-for banner */}
      <Surface variant="card" className="overflow-hidden border-grass-200 p-0 md:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grass-100 bg-grass-50/70 px-5 py-3">
          <span className="inline-flex items-center gap-2">
            <Search className="h-5 w-5 text-grass-700" />
            <span className="font-display text-base font-semibold uppercase tracking-wider text-grass-800">
              {t("looking_for")}
            </span>
            {match.level_band !== "any" ? (
              <span className="inline-flex items-center rounded-full bg-grass-600 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                {tLevels(match.level_band)}
              </span>
            ) : (
              <span className="text-sm text-ink-500">· {t("level_any")}</span>
            )}
          </span>
          <span
            className={
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider " +
              (match.status === "open"
                ? "bg-grass-100 text-grass-800"
                : match.status === "filled"
                  ? "bg-ink-100 text-ink-700"
                  : "bg-clay-100 text-clay-700")
            }
          >
            {t(`status.${match.status}`)}
          </span>
        </div>

        {/* Host strip */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
            {match.creator_avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={match.creator_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <Trophy className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {tDetail("creator_label")}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/players/${match.creator_id}` as any}
                className="font-display text-lg font-semibold text-ink-900 hover:text-grass-800"
              >
                {match.creator_name ?? "—"}
              </Link>
              <RatingDisplay
                internalElo={match.creator_elo}
                internalStatus={
                  match.creator_elo_status === "provisional" ? "provisional" : "established"
                }
                external={
                  match.creator_external_rating
                    ? {
                        source: "liga_tennisa",
                        elo: match.creator_external_rating.external_elo,
                        displayTier: match.creator_external_rating.display_tier,
                        externalUrl: match.creator_external_rating.external_url,
                        isCalibrating: match.creator_external_rating.is_calibrating_singles,
                      }
                    : null
                }
                variant="inline"
                size="sm"
              />
              <LevelBadge elo={match.creator_elo} />
            </div>
          </div>
        </div>
      </Surface>

      {/* Match details */}
      <Surface variant="card" as="section" className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-ink-700">
          <CalendarClock className="h-4 w-4 text-ink-400" />
          <span>{dateFmt.format(new Date(match.starts_at))}</span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-500">{t("duration_short", { min: match.duration_min })}</span>
        </div>

        {match.venue_name ? (
          <div className="flex items-center gap-2 text-sm text-ink-700">
            <Building2 className="h-4 w-4 text-ink-400" />
            <Link
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={`/venues/${match.venue_id}` as any}
              className="hover:text-grass-700 hover:underline"
            >
              {match.venue_name}
            </Link>
            {match.venue_city && <span className="text-ink-400">· {match.venue_city}</span>}
          </div>
        ) : match.district_name ? (
          <div className="flex items-center gap-2 text-sm text-ink-700">
            <MapPin className="h-4 w-4 text-ink-400" />
            {t("district_only", { name: match.district_name })}
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-sm text-ink-700">
          <Users className="h-4 w-4 text-ink-400" />
          <span>
            {t(match.format === "singles" ? "format_singles" : "format_doubles")} ·{" "}
            {t("slots_short", { count: match.slots_needed })}
          </span>
        </div>

        {match.notes && (
          <p className="sm:col-span-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
            {match.notes}
          </p>
        )}
      </Surface>

      {isCreator && (
        <p className="rounded-lg border border-grass-200 bg-grass-50 px-3 py-2 text-sm text-grass-800">
          {tDetail("self_post_hint")}
        </p>
      )}

      <ApplyControls
        locale={locale}
        matchId={match.id}
        matchStatus={match.status}
        isCreator={isCreator}
        myApplication={myApplication}
        applications={applications}
        copy={{
          your_application: tDetail("your_application"),
          your_application_status: tDetail("your_application_status"),
          status_pending: tDetail("app_status.pending"),
          status_accepted: tDetail("app_status.accepted"),
          status_rejected: tDetail("app_status.rejected"),
          status_withdrawn: tDetail("app_status.withdrawn"),
          apply_cta: tDetail("apply_cta"),
          apply_login: tDetail("apply_login"),
          apply_dialog_title: tDetail("apply_dialog_title"),
          apply_message_label: tDetail("apply_message_label"),
          apply_message_placeholder: tDetail("apply_message_placeholder"),
          apply_send: tDetail("apply_send"),
          apply_sending: tDetail("apply_sending"),
          withdraw_cta: tDetail("withdraw_cta"),
          decide_accept: tDetail("decide_accept"),
          decide_reject: tDetail("decide_reject"),
          cancel_cta: tDetail("cancel_cta"),
          cancel_confirm: tDetail("cancel_confirm"),
          applications_title: tDetail("applications_title"),
          applications_empty: tDetail("applications_empty"),
          err_already_applied: tDetail("errors.already_applied"),
          err_cannot_apply_to_own: tDetail("errors.cannot_apply_to_own"),
          err_open_match_closed: tDetail("errors.open_match_closed"),
          err_open_match_not_found: tDetail("errors.open_match_not_found"),
          err_not_authenticated: tDetail("errors.not_authenticated"),
          err_unknown: tDetail("errors.unknown"),
        }}
      />
    </div>
  );
}
