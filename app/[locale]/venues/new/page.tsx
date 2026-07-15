import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { UserVenueForm } from "@/components/venues/user-venue-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDistrictOptions } from "../user-actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "venuesCatalog.form" });
  return buildPageMetadata({
    locale,
    path: "/venues/new",
    title: t("create_title"),
    description: t("create_subtitle"),
  });
}

export default async function NewVenuePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("venuesCatalog.form");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const districts = await loadDistrictOptions();

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("venues"), path: "/venues" },
          { name: t("create_title"), path: "/venues/new" },
        ]}
      />
      <PageHeader
        title={t("create_title")}
        subtitle={t("create_subtitle")}
        help={
          <HelpPanel
            pageId="venue-new"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {user ? (
        <UserVenueForm userId={user.id} districts={districts} />
      ) : (
        <EmptyState
          title={t("guest_title")}
          description={t("guest_body")}
          ctaHref={`/${locale}/login`}
          ctaLabel={t("guest_cta")}
        />
      )}
    </div>
  );
}
