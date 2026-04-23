import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox, Send, History } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyProposals, type ProposalRow } from "../actions";
import { ProposalCard } from "./proposal-card";

type Props = { params: Promise<{ locale: string }> };

export default async function ProposalsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("find.proposals");

  const data = await loadMyProposals();
  if (!data) redirect(`/${locale}/login?next=/me/find/proposals`);

  const { incoming, sent, history } = data;

  const cardCopy = {
    accept: t("card.accept"),
    decline: t("card.decline"),
    cancel: t("card.cancel"),
    sending: t("card.sending"),
    accepted: t("card.accepted"),
    declined: t("card.declined"),
    cancelled: t("card.cancelled"),
    scheduled: t("card.scheduled"),
    proposed_by_you: t("card.proposed_by_you"),
    proposed_by_them: t("card.proposed_by_them"),
    written: t("card.written"),
    response: t("card.response"),
    whatsapp: t("card.whatsapp"),
    optional_note: t("card.optional_note"),
    confirm: t("card.confirm"),
    locale,
    whatsapp_prefill: t("card.whatsapp_prefill", { name: "{name}" }),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="space-y-2">
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/me/find` as any}
          className="inline-flex items-center gap-1 text-sm text-ink-500 transition hover:text-grass-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="me-find-proposals"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <Section
        icon={<Inbox className="h-4 w-4 text-grass-700" />}
        title={t("incoming")}
        count={incoming.length}
      >
        {incoming.length === 0 ? (
          <EmptyState title={t("empty_incoming_title")} description={t("empty_incoming_description")} />
        ) : (
          <ul className="space-y-3">
            {incoming.map((p) => (
              <ProposalCard key={p.id} row={p} kind="incoming" copy={cardCopy} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<Send className="h-4 w-4 text-grass-700" />}
        title={t("sent")}
        count={sent.length}
      >
        {sent.length === 0 ? (
          <EmptyState title={t("empty_sent_title")} description={t("empty_sent_description")} />
        ) : (
          <ul className="space-y-3">
            {sent.map((p) => (
              <ProposalCard key={p.id} row={p} kind="sent" copy={cardCopy} />
            ))}
          </ul>
        )}
      </Section>

      {history.length > 0 && (
        <Section
          icon={<History className="h-4 w-4 text-ink-500" />}
          title={t("history")}
          count={history.length}
        >
          <ul className="space-y-3">
            {history.slice(0, 20).map((p) => (
              <ProposalCard key={p.id} row={p} kind="history" copy={cardCopy} />
            ))}
          </ul>
        </Section>
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

export type ProposalsPageRow = ProposalRow;
