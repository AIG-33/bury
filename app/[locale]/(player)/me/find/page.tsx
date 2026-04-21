import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDistrictOptions } from "./actions";
import { WEEKDAYS, TIME_SLOTS } from "@/lib/profile/schema";
import type { Weekday, DayPart } from "@/lib/matching/find-player";
import { FindClient, type FindCopy } from "./find-client";

type Props = { params: Promise<{ locale: string }> };

export default async function FindPlayerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("find");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/me/find`);

  const districts = await loadDistrictOptions();

  const copy: FindCopy = {
    filters_title: t("filters.title"),
    district: t("filters.district"),
    district_placeholder: t("filters.district_placeholder"),
    elo_radius: t("filters.elo_radius"),
    availability: t("filters.availability"),
    availability_hint: t("filters.availability_hint"),
    hand: t("filters.hand"),
    hand_options: {
      both: t("filters.hand_options.both"),
      R: t("filters.hand_options.R"),
      L: t("filters.hand_options.L"),
    },
    query: t("filters.query"),
    query_placeholder: t("filters.query_placeholder"),
    search: t("filters.search"),
    searching: t("filters.searching"),
    reset: t("filters.reset"),
    empty_title: t("results.empty_title"),
    empty_description: t("results.empty_description"),
    weekday: Object.fromEntries(
      WEEKDAYS.map((d) => [d, t(`weekday.${d}`)]),
    ) as Record<Weekday, string>,
    weekday_short: Object.fromEntries(
      WEEKDAYS.map((d) => [d, t(`weekday_short.${d}`)]),
    ) as Record<Weekday, string>,
    daypart: Object.fromEntries(
      TIME_SLOTS.map((s) => [s, t(`daypart.${s}`)]),
    ) as Record<DayPart, string>,
    card: {
      elo: t("card.elo"),
      score: t("card.score"),
      overlap: t("card.overlap"),
      overlap_none: t("card.overlap_none"),
      propose: t("card.propose"),
      proposing: t("card.proposing"),
      sent: t("card.sent"),
      duplicate: t("card.duplicate"),
      self: t("card.self"),
      error: t("card.error"),
      whatsapp: t("card.whatsapp"),
      whatsapp_unavailable: t("card.whatsapp_unavailable"),
      optional_message: t("card.optional_message"),
      cancel: t("card.cancel"),
      confirm: t("card.confirm"),
    },
    whatsapp_prefill: t("whatsapp_prefill", { name: "{name}" }),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">
            {t("title")}
          </h1>
          <p className="text-ink-600">{t("subtitle")}</p>
        </div>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/me/find/proposals` as any}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
        >
          <Inbox className="h-4 w-4" />
          {t("proposals_link")}
        </Link>
      </header>

      <HelpPanel
        pageId="me-find"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <FindClient
        locale={locale as "pl" | "en" | "ru"}
        districts={districts}
        copy={copy}
      />
    </div>
  );
}
