import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Plus, FolderTree } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMyMemberships } from "./actions";
import { MyClubsClient } from "./my-clubs-client";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myClubs" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function MyClubsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent("/me/clubs")}`);

  const t = await getTranslations("myClubs");
  const tCommon = await getTranslations("clubsCommon");

  const res = await loadMyMemberships();
  if (!res.ok) redirect(`/${locale}/login`);
  const { memberships, pendingOwnershipOffers } = res;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-clubs"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/me/clubs/owned">
                <FolderTree className="h-4 w-4" />
                {t("owned_link")}
              </Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/me/clubs/owned?create=1">
                <Plus className="h-4 w-4" />
                {t("create_cta")}
              </Link>
            </Button>
          </>
        }
      />

      {memberships.length === 0 && pendingOwnershipOffers.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.body")}
          ctaLabel={t("empty.cta_browse")}
          ctaHref={`/${locale}/clubs`}
        />
      ) : (
        <MyClubsClient
          locale={locale}
          memberships={memberships}
          // Pre-format every per-row value here. The client component
          // receives only serialisable strings — Next.js 15 forbids passing
          // functions across the server→client component boundary.
          pendingOwnershipOffers={pendingOwnershipOffers.map((o) => ({
            ...o,
            expires_label: dateFmt.format(new Date(o.expires_at)),
          }))}
          labels={{
            section_approved: t("section_approved"),
            section_pending: t("section_pending"),
            section_rejected: t("section_rejected"),
            section_offers: t("section_offers"),
            primary_label: t("primary_label"),
            primary_set: t("primary_set"),
            primary_clear: t("primary_clear"),
            primary_help: t("primary_help"),
            owner_badge: t("owner_badge"),
            admin_badge: t("admin_badge"),
            edit: t("edit"),
            leave: t("leave"),
            leave_confirm: t("leave_confirm"),
            cancel_application: t("cancel_application"),
            // ICU pass-through: keep the literal `{club}` placeholder; the
            // client does a single .replace() at confirm-time.
            cancel_application_confirm_template: t("cancel_application_confirm", {
              club: "{club}",
            }),
            join_policy: {
              approval: tCommon("join_policy.approval"),
              open: tCommon("join_policy.open"),
              closed: tCommon("join_policy.closed"),
            },
            statuses: {
              pending: tCommon("statuses.pending"),
              approved: tCommon("statuses.approved"),
              rejected: tCommon("statuses.rejected"),
            },
            ownership_offer: {
              intro_template: t("ownership_offer.intro", {
                previous: "{previous}",
                club: "{club}",
              }),
              expires_template: t("ownership_offer.expires", { date: "{date}" }),
              accept: t("ownership_offer.accept"),
              decline: t("ownership_offer.decline"),
              accepting: t("ownership_offer.accepting"),
              errors: {
                transfer_not_offered: t("ownership_offer.errors.transfer_not_offered"),
                transfer_expired: t("ownership_offer.errors.transfer_expired"),
                unknown: t("ownership_offer.errors.unknown"),
              },
            },
          }}
        />
      )}
    </div>
  );
}

