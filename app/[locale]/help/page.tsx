import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Surface, SectionTitle, Chip } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "helpPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/help`,
      languages: { ru: "/ru/help", en: "/en/help" },
    },
  };
}

export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("helpPage");
  const tg = await getTranslations("guidePage");

  const glossary = [
    "elo",
    "k_factor",
    "provisional",
    "starting_elo",
    "race",
    "tournament_seed",
    "bye",
    "no_ad",
    "super_tiebreak",
    "wo",
    "match_proposal",
    "verified_coach",
    "trust_weighted",
    "outbox",
  ] as const;

  const faqs = [
    "q_register",
    "q_no_invite",
    "q_dispute",
    "q_payment",
    "q_cancel",
    "q_telegram",
    "q_data",
  ] as const;

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="help"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1")]}
          />
        }
      />

      <Link
        href={`/${locale}/help/guide`}
        className="surface-card lift-on-hover block"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-grass-900">
              {tg("card_cta_title")}
            </h2>
            <p className="mt-1 text-sm text-grass-800">{tg("card_cta_body")}</p>
          </div>
          <Chip tone="grass" aria-hidden>
            {tg("card_cta_button")}
          </Chip>
        </div>
      </Link>

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>{t("glossary_title")}</SectionTitle>
        <dl className="grid gap-3 sm:grid-cols-2">
          {glossary.map((g) => (
            <Surface variant="row" key={g}>
              <dt className="font-display text-sm font-semibold text-ink-900">
                {t(`glossary.${g}.term`)}
              </dt>
              <dd className="mt-1 text-sm text-ink-600">{t(`glossary.${g}.def`)}</dd>
            </Surface>
          ))}
        </dl>
      </section>

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>{t("faq_title")}</SectionTitle>
        <ul className="space-y-2">
          {faqs.map((q) => (
            <Surface variant="row" as="li" key={q}>
              <details className="group">
                <summary className="cursor-pointer font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-grass-500 align-middle" />
                  {t(`faq.${q}.q`)}
                </summary>
                <p className="mt-2 text-sm text-ink-600">{t(`faq.${q}.a`)}</p>
              </details>
            </Surface>
          ))}
        </ul>
      </section>

      <div className="court-line" aria-hidden />

      <Surface variant="soft" as="section">
        <h2 className="font-display text-lg font-semibold text-grass-900">{t("contact_title")}</h2>
        <p className="mt-1 text-sm text-grass-800">{t("contact_body")}</p>
      </Surface>
    </div>
  );
}
