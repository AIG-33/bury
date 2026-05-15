import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Award, ArrowRight } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { ExternalRatingCard } from "@/components/profile/external-rating-card";
import { ProfileForm } from "./profile-form";
import { TelegramLinkCard } from "./telegram-link-card";
import { loadMyProfile, loadTelegramLinkState } from "./actions";
import { loadMyCoachApplications } from "../become-coach/actions";
import { loadMyExternalRating } from "@/lib/rating/external/actions-impl";
import { WEEKDAYS, TIME_SLOTS } from "@/lib/profile/schema";

type Props = { params: Promise<{ locale: string }> };

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tSec = await getTranslations("accountSecurity");
  const tBecome = await getTranslations("becomeCoach");
  const tExt = await getTranslations("externalRating");

  const result = await loadMyProfile();
  if (!result.ok) redirect(`/${locale}/login`);

  const { profile, districts } = result;
  const externalRating = await loadMyExternalRating();
  const telegramState = await loadTelegramLinkState();
  const tTg = await getTranslations("telegramLink");

  // Surface the "become a coach" entry point right inside the player profile.
  // We piggyback on the same loader so we know whether the player is already
  // a coach, has a pending application, or can submit one.
  const applicationsResult = await loadMyCoachApplications();
  const becomeCoachState =
    applicationsResult.ok && applicationsResult.is_already_coach
      ? "is_coach"
      : applicationsResult.ok && applicationsResult.applications[0]?.status === "pending"
        ? "pending"
        : applicationsResult.ok && applicationsResult.applications[0]?.status === "rejected"
          ? "rejected"
          : "none";

  // Build copy for the client form
  const fields: Record<string, string> = Object.fromEntries(
    [
      "first_name",
      "last_name",
      "date_of_birth",
      "gender",
      "favorite_player",
      "motto",
      "phone",
      "whatsapp",
      "telegram_username",
      "primary_badge",
      "social_instagram",
      "social_facebook",
      "social_x",
      "social_tiktok",
      "social_youtube",
      "social_website",
      "city",
      "district",
      "dominant_hand",
      "backhand_style",
      "favorite_surface",
      "visible_in_find_player",
      "visible_in_leaderboard",
      "notification_email",
      "notification_whatsapp",
      "notification_telegram",
      "locale",
      "health_notes",
      "emergency_contact",
    ].map((k) => [k, t(`form.fields.${k}`)]),
  );

  const hints: Record<string, string> = Object.fromEntries(
    [
      "date_of_birth",
      "motto",
      "phone",
      "whatsapp",
      "telegram_username",
      "district",
      "backhand_style",
      "availability",
      "visible_in_find_player",
      "visible_in_leaderboard",
      "notification_email",
      "notification_whatsapp",
      "notification_telegram",
      "health_notes",
    ].map((k) => [k, t(`form.hints.${k}`)]),
  );

  const copy = {
    save: t("form.save"),
    saving: t("form.saving"),
    saved: t("form.saved"),
    error: t("form.error"),
    errors: {
      invalid_payload: t("form.errors.invalid_payload"),
      invalid_fields_prefix: t("form.errors.invalid_fields_prefix"),
      not_authenticated: t("form.errors.not_authenticated"),
      unknown: t("form.errors.unknown"),
    },
    field_errors: {
      invalid_url: t("form.field_errors.invalid_url"),
      invalid_phone: t("form.field_errors.invalid_phone"),
      invalid_telegram: t("form.field_errors.invalid_telegram"),
      invalid_date: t("form.field_errors.invalid_date"),
      too_long: t("form.field_errors.too_long"),
      required: t("form.field_errors.required"),
      invalid: t("form.field_errors.invalid"),
    },
    none: t("form.none"),
    sections: {
      personal: t("form.sections.personal"),
      contacts: t("form.sections.contacts"),
      socials: t("form.sections.socials"),
      location: t("form.sections.location"),
      sport: t("form.sections.sport"),
      availability: t("form.sections.availability"),
      privacy: t("form.sections.privacy"),
      notifications: t("form.sections.notifications"),
      health: t("form.sections.health"),
    },
    fields,
    hints,
    enums: {
      gender: {
        m: t("form.enums.gender.m"),
        f: t("form.enums.gender.f"),
        other: t("form.enums.gender.other"),
      },
      hand: {
        R: t("form.enums.hand.R"),
        L: t("form.enums.hand.L"),
      },
      backhand: {
        one_handed: t("form.enums.backhand.one_handed"),
        two_handed: t("form.enums.backhand.two_handed"),
      },
      surface: {
        hard: t("form.enums.surface.hard"),
        clay: t("form.enums.surface.clay"),
        grass: t("form.enums.surface.grass"),
        carpet: t("form.enums.surface.carpet"),
      },
      locale: {
        ru: t("form.enums.locale.ru"),
        en: t("form.enums.locale.en"),
      },
      weekday: Object.fromEntries(WEEKDAYS.map((d) => [d, t(`form.enums.weekday.${d}`)])) as Record<
        (typeof WEEKDAYS)[number],
        string
      >,
      daypart: Object.fromEntries(
        TIME_SLOTS.map((s) => [s, t(`form.enums.daypart.${s}`)]),
      ) as Record<(typeof TIME_SLOTS)[number], string>,
    },
    avatar: {
      upload: t("form.avatar.upload"),
      uploading: t("form.avatar.uploading"),
      remove: t("form.avatar.remove"),
      too_large: t("form.avatar.too_large"),
      bad_mime: t("form.avatar.bad_mime"),
      requirements: t("form.avatar.requirements"),
    },
  };

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("hello", { name: profile.display_name ?? profile.email ?? "player" })}
        help={
          <HelpPanel
            pageId="me-profile"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {becomeCoachState !== "is_coach" && (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={"/me/become-coach" as any}
          className="group flex items-start gap-3 rounded-xl2 border border-grass-200 bg-grass-50/60 p-4 shadow-card transition hover:border-grass-300 hover:bg-grass-50 lift-on-hover"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-grass-900">
              {tBecome("profile_card.title")}
            </p>
            <p className="mt-1 text-sm text-grass-800">
              {becomeCoachState === "pending"
                ? tBecome("profile_card.body_pending")
                : becomeCoachState === "rejected"
                  ? tBecome("profile_card.body_rejected")
                  : tBecome("profile_card.body_none")}
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-grass-700 transition group-hover:translate-x-0.5" />
        </Link>
      )}

      <ExternalRatingCard
        locale={locale as "ru" | "en"}
        initial={externalRating}
        copy={{
          title: tExt("card.title"),
          subtitle: tExt("card.subtitle"),
          source_label: tExt("source_label"),
          not_connected_title: tExt("not_connected.title"),
          not_connected_body: tExt("not_connected.body"),
          not_connected_cta: tExt("not_connected.cta"),
          refresh: tExt("refresh"),
          refreshing: tExt("refreshing"),
          refreshed_now: tExt("refreshed_now"),
          refreshed_ago: tExt("refreshed_ago"),
          disconnect: tExt("disconnect"),
          disconnecting: tExt("disconnecting"),
          confirm_disconnect: tExt("confirm_disconnect"),
          imported_at_label: tExt("imported_at_label"),
          last_refreshed_label: tExt("last_refreshed_label"),
          last_refresh_error_label: tExt("last_refresh_error_label"),
          open_on_lt: tExt("open_on_lt"),
          errors: {
            not_authenticated: tExt("errors.not_authenticated"),
            no_external_rating: tExt("errors.no_external_rating"),
            rate_limited: tExt("errors.rate_limited"),
            upstream_unreachable: tExt("errors.upstream_unreachable"),
            upstream_error: tExt("errors.upstream_error"),
            player_not_found: tExt("errors.player_not_found"),
            db_error: tExt("errors.db_error"),
            unknown: tExt("errors.unknown"),
          },
        }}
      />

      <TelegramLinkCard
        linked={telegramState.linked}
        botUsername={telegramState.botUsername}
        startUrl={telegramState.startUrl}
        copy={{
          title: tTg("title"),
          body_linked: tTg("body_linked"),
          body_unlinked: tTg("body_unlinked"),
          cta_open_bot: tTg("cta_open_bot"),
          cta_copy_link: tTg("cta_copy_link"),
          cta_copied: tTg("cta_copied"),
          not_configured: tTg("not_configured"),
        }}
      />

      <ProfileForm
        locale={locale as "ru" | "en"}
        profile={profile}
        districts={districts}
        copy={copy}
      />

      {profile.email && (
        <ChangePasswordCard
          email={profile.email}
          copy={{
            title: tSec("title"),
            subtitle: tSec("subtitle"),
            email_label: tSec("email_label"),
            current_password: tSec("current_password"),
            new_password: tSec("new_password"),
            confirm_password: tSec("confirm_password"),
            cta_change: tSec("cta_change"),
            cta_send_link: tSec("cta_send_link"),
            link_mode_hint: tSec("link_mode_hint"),
            toggle_to_link: tSec("toggle_to_link"),
            toggle_to_direct: tSec("toggle_to_direct"),
            sending: tSec("sending"),
            saving: tSec("saving"),
            success_changed: tSec("success_changed"),
            success_link_sent: tSec("success_link_sent"),
            error: tSec("error"),
            mismatch: tSec("mismatch"),
            min_hint: tSec("min_hint"),
            wrong_current: tSec("wrong_current"),
          }}
        />
      )}
    </div>
  );
}
