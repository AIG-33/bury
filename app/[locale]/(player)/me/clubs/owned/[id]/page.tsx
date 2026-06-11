import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/me/clubs/owned/${id}`)}`);

  const t = await getTranslations("clubsOwned");

  const [res, districts] = await Promise.all([loadOwnedClubDetail(id), loadDistrictOptionsForClubs()]);
  if (!res.ok) {
    if (res.error === "not_found") notFound();
    redirect(`/${locale}/me/clubs/owned`);
  }
  const { club, pending, members } = res;

  return (
    <div className="page-shell space-y-6">
      <Link
        href={`/${locale}/me/clubs/owned` as never}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <PageHeader
        title={club.name}
        subtitle={club.slug}
        help={
          <HelpPanel
            pageId="me-clubs-owned-detail"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2"), t("help.result.3")]}
          />
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`/${locale}/clubs/${club.slug}` as never}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              {t("detail.view_public")}
            </Link>
          </Button>
        }
      />

      <OwnerPanel locale={locale} club={club} pending={pending} members={members} districts={districts} />
    </div>
  );
}
