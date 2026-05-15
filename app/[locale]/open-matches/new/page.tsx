import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OPEN_MATCH_LEVEL_BANDS } from "@/lib/open-matches/schema";
import { CreateOpenMatchForm } from "./create-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ venue?: string }>;
};

export default async function NewOpenMatchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("openMatches");
  const tCreate = await getTranslations("openMatches.create");
  const tLevels = await getTranslations("levels");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/open-matches/new`);

  const [venuesRes, districtsRes] = await Promise.all([
    supabase.from("venues").select("id, name, city").order("name", { ascending: true }),
    supabase
      .from("districts")
      .select("id, name, city")
      .eq("country", "BY")
      .order("city", { ascending: true })
      .order("name", { ascending: true }),
  ]);
  const venues =
    (venuesRes.data as Array<{ id: string; name: string; city: string | null }> | null) ?? [];
  const districts =
    (districtsRes.data as Array<{ id: string; name: string; city: string }> | null) ?? [];

  const initialVenueId = venues.some((v) => v.id === sp.venue) ? sp.venue : undefined;

  const levelOptions = OPEN_MATCH_LEVEL_BANDS.map((id) => ({
    id,
    label: id === "any" ? t("level_any") : tLevels(id),
  }));

  return (
    <div className="page-shell space-y-6">
      <Link
        href="/open-matches"
        className="inline-flex items-center gap-1 text-sm text-ink-600 transition hover:text-grass-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCreate("back")}
      </Link>

      <PageHeader
        title={tCreate("title")}
        subtitle={tCreate("subtitle")}
        help={
          <HelpPanel
            pageId="open-matches-new"
            variant="inline"
            why={tCreate("help.why")}
            what={[tCreate("help.what.1"), tCreate("help.what.2"), tCreate("help.what.3")]}
            result={[tCreate("help.result.1"), tCreate("help.result.2")]}
          />
        }
      />

      <CreateOpenMatchForm
        locale={locale}
        venues={venues}
        districts={districts}
        levelOptions={levelOptions}
        initialVenueId={initialVenueId}
        copy={{
          venue: tCreate("fields.venue_optional"),
          district: tCreate("fields.district_optional"),
          starts_at: tCreate("fields.starts_at"),
          duration: tCreate("fields.duration"),
          format: tCreate("fields.format"),
          format_singles: t("format_singles"),
          format_doubles: t("format_doubles"),
          level: tCreate("fields.level"),
          slots: tCreate("fields.slots"),
          notes: tCreate("fields.notes"),
          notes_placeholder: tCreate("fields.notes_placeholder"),
          submit: tCreate("submit"),
          submitting: tCreate("submitting"),
          err_invalid_payload: tCreate("errors.invalid_payload"),
          err_starts_in_past: tCreate("errors.starts_in_past"),
          err_singles_one_slot_only: tCreate("errors.singles_one_slot_only"),
          err_location_required: tCreate("errors.location_required"),
          err_not_authenticated: tCreate("errors.not_authenticated"),
          err_unknown: tCreate("errors.unknown"),
          any_venue: t("filters.any_venue"),
          any_district: t("filters.any_venue"),
        }}
      />
    </div>
  );
}
