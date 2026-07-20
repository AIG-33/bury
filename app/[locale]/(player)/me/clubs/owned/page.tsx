import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOwnedClubs } from "./actions";
import { loadDistrictOptionsForClubs } from "../../../../clubs/actions";
import { OwnedClubsClient } from "./owned-client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ create?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clubsOwned" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function OwnedClubsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent("/me/clubs/owned")}`);

  const t = await getTranslations("clubsOwned");
  const tCommon = await getTranslations("clubsCommon");

  const [res, districts] = await Promise.all([loadOwnedClubs(), loadDistrictOptionsForClubs()]);
  if (!res.ok) redirect(`/${locale}/login`);
  const { clubs } = res;

  return (
    <div className="page-shell space-y-6">
      <Link
        href="/me/clubs"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-clubs-owned"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2"), t("help.result.3")]}
          />
        }
      />

      {clubs.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <OwnedClubsClient
              locale={locale}
              clubs={[]}
              districts={districts}
              autoOpenCreate={sp.create === "1"}
              labels={getLabels(t, tCommon)}
            />
          }
        />
      ) : (
        <OwnedClubsClient
          locale={locale}
          clubs={clubs}
          districts={districts}
          autoOpenCreate={sp.create === "1"}
          labels={getLabels(t, tCommon)}
        />
      )}
    </div>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function getLabels(t: T, tCommon: T) {
  return {
    create_cta: t("create_cta"),
    empty_cta: t("empty.cta"),
    card: {
      members: t("card.members"),
      pending: t("card.pending"),
      open: t("card.open"),
      edit: t("card.edit"),
      owner_badge: t("card.owner_badge"),
      admin_badge: t("card.admin_badge"),
      transfer_pending: t("card.transfer_pending"),
    },
    dialog: {
      create_title: t("dialog.create_title"),
      edit_title: t("dialog.edit_title"),
      fields: {
        name: t("dialog.fields.name"),
        slug: t("dialog.fields.slug"),
        slug_hint: t("dialog.fields.slug_hint"),
        description: t("dialog.fields.description"),
        description_hint: t("dialog.fields.description_hint"),
        city: t("dialog.fields.city"),
        district: t("dialog.fields.district"),
        district_any: t("dialog.fields.district_any"),
        join_policy: t("dialog.fields.join_policy"),
        hide_owner: t("dialog.fields.hide_owner"),
        hide_owner_hint: t("dialog.fields.hide_owner_hint"),
      },
      hints: {
        approval: t("dialog.fields.join_policy_hints.approval"),
        open: t("dialog.fields.join_policy_hints.open"),
        closed: t("dialog.fields.join_policy_hints.closed"),
      },
      save: t("dialog.save"),
      saving: t("dialog.saving"),
      cancel: t("dialog.cancel"),
      errors: {
        name_too_short: t("dialog.errors.name_too_short"),
        name_too_long: t("dialog.errors.name_too_long"),
        slug_invalid: t("dialog.errors.slug_invalid"),
        slug_too_short: t("dialog.errors.slug_too_short"),
        slug_too_long: t("dialog.errors.slug_too_long"),
        slug_owner_only: t("dialog.errors.slug_owner_only"),
        unknown: t("dialog.errors.unknown"),
      },
    },
    join_policy_labels: {
      approval: tCommon("join_policy.approval"),
      open: tCommon("join_policy.open"),
      closed: tCommon("join_policy.closed"),
    },
  };
}
