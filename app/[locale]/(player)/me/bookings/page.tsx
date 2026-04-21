import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import {
  loadMyBookings,
  loadDistrictsForBooking,
} from "./actions";
import { BookingsClient, type BookingsCopy } from "./bookings-client";
import {
  SLOT_TYPES,
  BOOKING_STATUSES,
  PAID_STATUSES,
  type SlotType,
  type BookingStatus,
  type PaidStatus,
} from "@/lib/slots/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string }> };

export default async function MyBookingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bookings");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/me/bookings`);

  const [my, districts] = await Promise.all([
    loadMyBookings(),
    loadDistrictsForBooking(),
  ]);
  if (!my.ok) redirect(`/${locale}/login`);

  const slotTypeOptions = Object.fromEntries(
    SLOT_TYPES.map((s) => [s, t(`slot_type_options.${s}`)]),
  ) as Record<SlotType, string>;
  const statusOptions = Object.fromEntries(
    BOOKING_STATUSES.map((s) => [s, t(`status_options.${s}`)]),
  ) as Record<BookingStatus, string>;
  const paidOptions = Object.fromEntries(
    PAID_STATUSES.map((s) => [s, t(`paid_options.${s}`)]),
  ) as Record<PaidStatus, string>;

  const copy: BookingsCopy = {
    search: {
      title: t("search.title"),
      intro: t("search.intro"),
      from: t("search.from"),
      to: t("search.to"),
      district: t("search.district"),
      any_district: t("search.any_district"),
      submit: t("search.submit"),
      searching: t("search.searching"),
      empty_title: t("search.empty_title"),
      empty_description: t("search.empty_description"),
      no_results: t("search.no_results"),
    },
    upcoming_title: t("upcoming_title"),
    past_title: t("past_title"),
    no_upcoming: t("no_upcoming"),
    no_past: t("no_past"),
    card: {
      book: t("card.book"),
      booking: t("card.booking"),
      booked: t("card.booked"),
      cancel: t("card.cancel"),
      cancelling: t("card.cancelling"),
      cancel_confirm: t("card.cancel_confirm"),
      full: t("card.full"),
      error: t("card.error"),
      free_seats: t("card.free_seats"),
      contact_coach: t("card.contact_coach"),
      no_whatsapp: t("card.no_whatsapp"),
      notes_label: t("card.notes_label"),
      notes_placeholder: t("card.notes_placeholder"),
      whatsapp_prefill: t("card.whatsapp_prefill", { name: "{name}" }),
    },
    status_options: statusOptions,
    paid_options: paidOptions,
    slot_type_options: slotTypeOptions,
    locale,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="me-bookings"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <BookingsClient
        copy={copy}
        districts={districts}
        upcoming={my.upcoming}
        past={my.past}
      />
    </div>
  );
}
