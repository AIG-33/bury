import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOwnedClubDetail } from "../actions";
import { loadDistrictOptionsForClubs } from "../../../../../clubs/actions";
import { OwnerPanel } from "./owner-panel";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function OwnedClubDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?redirect=/${locale}/me/clubs/owned/${id}`);

  const t = await getTranslations("clubsOwned");

  const [res, districts] = await Promise.all([loadOwnedClubDetail(id), loadDistrictOptionsForClubs()]);
  if (!res.ok) {
    if (res.error === "not_found") notFound();
    redirect(`/${locale}/me/clubs/owned`);
  }
  const { club, pending, members } = res;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href={`/${locale}/me/clubs/owned`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-2xl font-bold text-ink-900">{club.name}</h1>
            <HelpPanel
              pageId="me-clubs-owned-detail"
              variant="inline"
              why={t("help.why")}
              what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
              result={[t("help.result.1"), t("help.result.2"), t("help.result.3")]}
            />
          </div>
          <p className="text-sm text-ink-500">{club.slug}</p>
        </div>
        <Link
          href={`/${locale}/clubs/${club.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          <ExternalLink className="h-4 w-4" />
          {t("detail.view_public")}
        </Link>
      </header>

      <OwnerPanel locale={locale} club={club} pending={pending} members={members} districts={districts} />
    </div>
  );
}
