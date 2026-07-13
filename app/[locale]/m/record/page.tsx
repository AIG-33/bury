import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RecordScore } from "./record-score";

// =============================================================================
// Screen «Записать счёт» (design «PlayTennis Screens», экран F).
// Opens like a modal (× in the header): you vs opponent cards on top,
// format segment (2 сета / 3 сета / про-сет), big −/+ steppers per set,
// automatic result banner with the ±ELO forecast, save CTA at the bottom.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

export default async function MobileRecordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/m/record`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("display_name, avatar_url, current_elo, rated_matches_count")
    .eq("id", user.id)
    .maybeSingle()) as {
    data: {
      display_name: string | null;
      avatar_url: string | null;
      current_elo: number;
      rated_matches_count: number;
    } | null;
  };

  return (
    <RecordScore
      me={{
        name: profile?.display_name ?? null,
        avatar: profile?.avatar_url ?? null,
        elo: profile?.current_elo ?? 1000,
        ratedMatches: profile?.rated_matches_count ?? 0,
      }}
      labels={{
        title: t("record.title"),
        close: t("record.close"),
        you: t("record.you"),
        vs: t("record.vs"),
        opponent: t("record.opponent"),
        opponent_pick: t("record.opponent_pick"),
        opponent_search: t("record.opponent_search"),
        opponent_empty: t("record.opponent_empty"),
        seg_two: t("record.seg_two"),
        seg_three: t("record.seg_three"),
        seg_proset: t("record.seg_proset"),
        sets_eyebrow: t("record.sets_eyebrow"),
        set_label: t("record.set_label"),
        win_forecast: t("record.win_forecast"),
        loss_forecast: t("record.loss_forecast"),
        save: t("record.save"),
        saving: t("record.saving"),
        saved_title: t("record.saved_title"),
        saved_body: t("record.saved_body"),
        to_matches: t("record.to_matches"),
        error: t("common.error_generic"),
        minus: t("record.minus"),
        plus: t("record.plus"),
      }}
    />
  );
}
