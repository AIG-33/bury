import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { loadCoachSlots } from "./actions";
import { SlotsClient, WeekNav, type SlotsListCopy } from "./slots-client";
import { SLOT_TYPES, ISO_WEEKDAYS, type SlotType, type IsoWeekday } from "@/lib/slots/schema";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function CoachSlotsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { from } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("slotsCoach");

  // Default window: today → +14 days.
  const fromDate = from
    ? new Date(`${from}T00:00:00Z`)
    : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const toDate = new Date(fromDate.getTime() + 14 * 86400_000);

  const result = await loadCoachSlots({
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
  });
  if (!result.ok) {
    if (result.error === "not_authenticated") redirect(`/${locale}/login?next=/coach/slots`);
    if (result.error === "not_a_coach") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/login`);
  }

  const slotTypeOptions = Object.fromEntries(
    SLOT_TYPES.map((s) => [s, t(`slot_type_options.${s}`)]),
  ) as Record<SlotType, string>;

  const weekdayShort = Object.fromEntries(
    ISO_WEEKDAYS.map((d) => [d, t(`weekday_short.${d}`)]),
  ) as Record<IsoWeekday, string>;

  const copy: SlotsListCopy = {
    empty_title: t("empty_title"),
    empty_description: t("empty_description"),
    empty_cta: t("empty_cta"),
    add: t("add"),
    cancel: t("cancel"),
    cancel_confirm: t("cancel_confirm"),
    cancelling: t("cancelling"),
    range_label: t("range_label"),
    prev_week: t("prev_week"),
    next_week: t("next_week"),
    today: t("today"),
    slot_type_options: slotTypeOptions,
    status_options: {
      open: t("status_options.open"),
      closed: t("status_options.closed"),
      cancelled: t("status_options.cancelled"),
    },
    participants: t("participants"),
    free: t("free"),
    full: t("full"),
    no_courts_title: t("no_courts_title"),
    no_courts_description: t("no_courts_description"),
    no_courts_cta: t("no_courts_cta"),
    weekday_short: weekdayShort,
    locale,
    dialog: {
      title: t("dialog.title"),
      intro: t("dialog.intro"),
      fields: {
        court: t("dialog.fields.court"),
        kind: t("dialog.fields.kind"),
        date: t("dialog.fields.date"),
        start_date: t("dialog.fields.start_date"),
        weeks: t("dialog.fields.weeks"),
        weekdays: t("dialog.fields.weekdays"),
        start_time: t("dialog.fields.start_time"),
        duration: t("dialog.fields.duration"),
        slot_type: t("dialog.fields.slot_type"),
        max_participants: t("dialog.fields.max_participants"),
        price_pln: t("dialog.fields.price_pln"),
        notes: t("dialog.fields.notes"),
        range_from: t("dialog.fields.range_from"),
        range_to: t("dialog.fields.range_to"),
        selected_dates: t("dialog.fields.selected_dates"),
      },
      hints: {
        weekly: t("dialog.hints.weekly"),
        duration: t("dialog.hints.duration"),
        price: t("dialog.hints.price"),
        max_participants: t("dialog.hints.max_participants"),
        dates: t("dialog.hints.dates"),
      },
      kinds: {
        single: t("dialog.kinds.single"),
        weekly: t("dialog.kinds.weekly"),
        dates: t("dialog.kinds.dates"),
      },
      slot_type_options: slotTypeOptions,
      weekday_short: weekdayShort,
      add_range: t("dialog.add_range"),
      add_date: t("dialog.add_date"),
      clear_all: t("dialog.clear_all"),
      selected_count: t("dialog.selected_count"),
      no_dates_yet: t("dialog.no_dates_yet"),
      weekday_filter_label: t("dialog.weekday_filter_label"),
      weekday_filter_all: t("dialog.weekday_filter_all"),
      save: t("dialog.save"),
      saving: t("dialog.saving"),
      cancel: t("dialog.cancel"),
      error: t("dialog.error"),
      no_courts: t("dialog.no_courts"),
    },
  };

  const fromIsoForNav = fromDate.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="coach-slots"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <WeekNav fromIso={fromIsoForNav} copy={copy} />
      <p className="text-xs text-ink-500">
        {t("range_label", {
          from: fromDate.toLocaleDateString(locale, {
            day: "numeric",
            month: "long",
          }),
          to: toDate.toLocaleDateString(locale, {
            day: "numeric",
            month: "long",
          }),
        })}
      </p>

      <SlotsClient initialSlots={result.slots} courts={result.courts} copy={copy} />
    </div>
  );
}
