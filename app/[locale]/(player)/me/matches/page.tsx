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
import Link from "next/link";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyMatches } from "./actions";
import { MatchCard } from "./match-card";
import { QuickRegisterButton } from "./quick-register-button";

type Props = { params: Promise<{ locale: string }> };

export default async function MyMatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myMatches");

  const data = await loadMyMatches();
  if (!data) redirect(`/${locale}/login?next=/me/matches`);

  const whatsappPrefill = t("whatsapp_prefill", { name: "{name}" });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-3xl font-bold text-ink-900">
              {t("title")}
            </h1>
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
          </div>
          <p className="mt-1 text-ink-600">{t("subtitle")}</p>
        </div>
        <QuickRegisterButton />
      </header>

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

      {/* History link — full match history with Elo deltas now lives on /me/rating */}
      <Link
        href={`/${locale}/me/rating#matches`}
        className="group flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-sm transition hover:border-grass-200 hover:bg-grass-50/40"
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
          <div className="rounded-xl2 border border-dashed border-ink-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-grass-400" />
            <p className="mt-2 font-display text-lg text-ink-900">
              {t("empty.everything_title")}
            </p>
            <p className="text-sm text-ink-600">{t("empty.everything_body")}</p>
          </div>
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
        <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
