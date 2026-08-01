import { setRequestLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { Bell, CalendarDays, ChevronRight, Trophy, Users } from "lucide-react";
import { Link } from "@/i18n/routing";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MContent, MEmptyState, MEyebrow, MSubHeader } from "@/components/mobile/m-ui";
import { TennisBallIcon } from "@/components/mobile/m-icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notificationHref } from "@/lib/notifications/link";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen «Уведомления» (design «PlayTennis Screens», экран G).
// Grouped by time (Сегодня / Ранее); the icon badge encodes the type
// (игра / занятие / турнир / клуб), fresh items get a green dot. Source —
// the `notifications_outbox` table (RLS: recipient reads their own rows).
// One event may be queued to several channels — rows are de-duplicated by
// template + payload.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

const PayloadSchema = z.record(z.string(), z.unknown());

const KNOWN_TEMPLATES = [
  "booking_confirmed",
  "booking_cancelled",
  "booking_reminder_24h",
  "match_proposal",
  "match_accepted",
  "tournament_application_submitted",
  "tournament_starting_24h",
  "tournament_match_scheduled",
  "club_member_kicked",
  "club_ownership_offered",
] as const;

type KnownTemplate = (typeof KNOWN_TEMPLATES)[number];

function isKnownTemplate(value: string): value is KnownTemplate {
  return (KNOWN_TEMPLATES as readonly string[]).includes(value);
}

function pickString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export default async function MobileNotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tabBar = (
    <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
  );

  const header = (
    <MSubHeader title={t("notifications.title")} backHref="/m/more" backLabel={t("common.back")} />
  );

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <MContent className="flex-1 pt-5">
          <MEmptyState
            title={t("common.login_required_title")}
            body={t("common.login_required_body")}
            cta={t("common.login")}
            href="/login"
          />
        </MContent>
        {tabBar}
      </div>
    );
  }

  const { data: rows } = (await supabase
    .from("notifications_outbox")
    .select("id, template, payload, link_url, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60)) as {
    data: Array<{
      id: string;
      template: string;
      payload: unknown;
      link_url: string | null;
      created_at: string;
    }> | null;
  };

  // De-duplicate multi-channel copies of the same event.
  const seen = new Set<string>();
  const items = (rows ?? []).filter((row) => {
    const key = `${row.template}:${JSON.stringify(row.payload ?? null)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Minsk",
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });

  const todayKey = dayKeyFmt.format(new Date());
  const today = items.filter((r) => dayKeyFmt.format(new Date(r.created_at)) === todayKey);
  const earlier = items.filter((r) => dayKeyFmt.format(new Date(r.created_at)) !== todayKey);

  const renderRow = (row: (typeof items)[number]) => {
    const payload = PayloadSchema.safeParse(row.payload);
    const data = payload.success ? payload.data : {};
    const title = isKnownTemplate(row.template)
      ? t(`notifications.tpl_${row.template}` as never)
      : t("notifications.tpl_generic");
    const opponent = pickString(data, ["opponent_name"]);
    const tournament = pickString(data, ["tournament_name"]);
    const detail =
      row.template === "tournament_match_scheduled" && opponent && tournament
        ? t("notifications.detail_match", { tournament, opponent })
        : pickString(data, ["name", "tournament_name", "venue", "club_name", "court"]);
    const href = notificationHref({
      template: row.template,
      payload: row.payload,
      linkUrl: row.link_url,
      mobile: true,
    });
    const fresh = Date.now() - Date.parse(row.created_at) < 48 * 3600_000;
    const isToday = dayKeyFmt.format(new Date(row.created_at)) === todayKey;

    const tone = row.template.startsWith("booking")
      ? "bg-sun-50 text-sun-600"
      : row.template.startsWith("club")
        ? "bg-pt-icon text-grass-600"
        : "bg-pt-icon text-grass-600";
    const Icon = row.template.startsWith("booking") ? (
      <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.8} />
    ) : row.template.startsWith("match") ? (
      <TennisBallIcon className="h-[17px] w-[17px]" />
    ) : row.template.startsWith("tournament") ? (
      <Trophy className="h-[17px] w-[17px]" strokeWidth={1.8} />
    ) : row.template.startsWith("club") ? (
      <Users className="h-[17px] w-[17px]" strokeWidth={1.8} />
    ) : (
      <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
    );

    const inner = (
      <>
        <span
          className={`grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] ${tone}`}
        >
          {Icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold leading-[1.3] text-ink-900">{title}</p>
          {detail ? (
            <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">{detail}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[10.5px] font-semibold text-[#8AA093]">
          {isToday
            ? timeFmt.format(new Date(row.created_at))
            : dateFmt.format(new Date(row.created_at))}
          {fresh ? (
            <span className="h-[7px] w-[7px] rounded-full bg-grass-500" aria-hidden />
          ) : null}
          {href ? (
            <ChevronRight className="h-[14px] w-[14px] text-[#8AA093]" strokeWidth={2} />
          ) : null}
        </span>
      </>
    );

    const cardCls = [
      "flex items-start gap-3 rounded-[15px] border bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)]",
      fresh ? "border-[rgba(28,122,70,0.22)]" : "border-[rgba(20,60,30,0.06)]",
    ].join(" ");

    return (
      <li key={row.id}>
        {href ? (
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={href as any}
            className={`${cardCls} transition-colors active:bg-[#F4F8F4]`}
          >
            {inner}
          </Link>
        ) : (
          <div className={cardCls}>{inner}</div>
        )}
      </li>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <MContent className="flex-1 pt-4">
        {items.length === 0 ? (
          <MEmptyState
            title={t("notifications.empty_title")}
            body={t("notifications.empty_body")}
            cta={t("home.qa_find")}
            href="/m/game"
          />
        ) : (
          <div className="space-y-5">
            {today.length > 0 ? (
              <div>
                <MEyebrow className="mb-2">{t("notifications.group_today")}</MEyebrow>
                <ul className="space-y-[8px]">{today.map(renderRow)}</ul>
              </div>
            ) : null}
            {earlier.length > 0 ? (
              <div>
                <MEyebrow className="mb-2">{t("notifications.group_earlier")}</MEyebrow>
                <ul className="space-y-[8px]">{earlier.map(renderRow)}</ul>
              </div>
            ) : null}
          </div>
        )}
      </MContent>
      {tabBar}
    </div>
  );
}
