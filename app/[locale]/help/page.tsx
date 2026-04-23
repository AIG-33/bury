import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "helpPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/help`,
      languages: { pl: "/pl/help", en: "/en/help", ru: "/ru/help" },
    },
  };
}

export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("helpPage");

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

  const faqs = ["q_register", "q_no_invite", "q_dispute", "q_payment", "q_cancel", "q_telegram", "q_data"] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="help"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{t("glossary_title")}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {glossary.map((g) => (
            <div
              key={g}
              className="rounded-lg border border-ink-100 bg-white p-3"
            >
              <dt className="font-display text-sm font-semibold text-ink-900">
                {t(`glossary.${g}.term`)}
              </dt>
              <dd className="mt-1 text-sm text-ink-600">{t(`glossary.${g}.def`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{t("faq_title")}</h2>
        <ul className="space-y-2">
          {faqs.map((q) => (
            <li
              key={q}
              className="rounded-lg border border-ink-100 bg-white p-4"
            >
              <details className="group">
                <summary className="cursor-pointer font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-leaf-500 align-middle" />
                  {t(`faq.${q}.q`)}
                </summary>
                <p className="mt-2 text-sm text-ink-600">{t(`faq.${q}.a`)}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl2 border border-ink-100 bg-leaf-50 p-5">
        <h2 className="font-display text-lg font-semibold text-leaf-900">{t("contact_title")}</h2>
        <p className="mt-1 text-sm text-leaf-800">{t("contact_body")}</p>
      </section>
    </div>
  );
}
