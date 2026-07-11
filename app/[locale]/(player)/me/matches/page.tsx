import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { loadMyMatches } from "./actions";
import { MatchCard } from "./match-card";
import { QuickRegisterButton } from "./quick-register-button";
import { RecentHistory } from "./recent-history";

type Props = { params: Promise<{ locale: string }> };

export default async function MyMatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myMatches");

  const data = await loadMyMatches();
  if (!data) redirect(`/${locale}/login?next=/me/matches`);

  const whatsappPrefill = t("whatsapp_prefill", { name: "{name}" });

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-matches"
            variant="inline"
            why={t("help.why")}
            what={[
              t("help.what.1"),
              t("help.what.2"),
              t("help.what.3"),
              t("help.what.4"),
            ]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
        actions={<QuickRegisterButton />}
      />

      <Section
        icon={<AlertTriangle className="h-4 w-4 text-ball-700" />}
        title={t("awaiting_my_confirmation")}
        count={data.awaitingMyConfirmation.length}
      >
        {data.awaitingMyConfirmation.length === 0 ? (
          <EmptyState
            title={t("empty.awaiting_my_title")}
            description={t("empty.awaiting_my_body")}
          />
        ) : (
          <ul className="space-y-3">
            {data.awaitingMyConfirmation.map((m) => (
              <MatchCard
                key={m.id}
                m={m}
                variant="awaiting_my_confirmation"
                locale={locale}
                whatsappPrefill={whatsappPrefill}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<Clock className="h-4 w-4 text-ink-500" />}
        title={t("awaiting_their_confirmation")}
        count={data.awaitingTheirConfirmation.length}
      >
        {data.awaitingTheirConfirmation.length === 0 ? (
          <EmptyState
            title={t("empty.awaiting_them_title")}
            description={t("empty.awaiting_them_body")}
          />
        ) : (
          <ul className="space-y-3">
            {data.awaitingTheirConfirmation.map((m) => (
              <MatchCard
                key={m.id}
                m={m}
                variant="awaiting_their_confirmation"
                locale={locale}
                whatsappPrefill={whatsappPrefill}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<Calendar className="h-4 w-4 text-grass-700" />}
        title={t("scheduled")}
        count={data.scheduled.length}
      >
        {data.scheduled.length === 0 ? (
          <EmptyState
            title={t("empty.scheduled_title")}
            description={t("empty.scheduled_body")}
          />
        ) : (
          <ul className="space-y-3">
            {data.scheduled.map((m) => (
              <MatchCard
                key={m.id}
                m={m}
                variant="scheduled"
                locale={locale}
                whatsappPrefill={whatsappPrefill}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Recent — most recent completed matches (friendly AND tournament),
          with client-side filters by date and event type. Tournament matches
          land here through the same `matches` table; the filter UI lets a
          player narrow down to e.g. "last 30 days, tournaments only". */}
      {data.recent.length > 0 && (
        <Section
          icon={<History className="h-4 w-4 text-grass-700" />}
          title={t("recent")}
          count={data.recent.length}
        >
          <RecentHistory
            items={data.recent}
            locale={locale}
            whatsappPrefill={whatsappPrefill}
          />
        </Section>
      )}

      {/* History link — full match history with Elo deltas now lives on /me/rating */}
      <Link
        href="/me/rating#matches"
        className="group surface-row lift-on-hover flex items-center justify-between gap-3"
      >
        <span className="inline-flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700">
            <History className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink-900">
              {t("history_link.title")}
            </p>
            <p className="text-xs text-ink-600">
              {t("history_link.subtitle")}
            </p>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-grass-700 transition group-hover:translate-x-0.5" />
      </Link>

      {data.scheduled.length === 0 &&
        data.awaitingMyConfirmation.length === 0 &&
        data.awaitingTheirConfirmation.length === 0 && (
          <Surface variant="soft" className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-grass-400" />
            <p className="mt-2 font-display text-base font-bold text-grass-900">
              {t("empty.everything_title")}
            </p>
            <p className="mt-1 text-sm text-ink-600">{t("empty.everything_body")}</p>
          </Surface>
        )}
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="section-title">{title}</h2>
        <span className="chip chip-ink">{count}</span>
      </div>
      {children}
    </section>
  );
}
