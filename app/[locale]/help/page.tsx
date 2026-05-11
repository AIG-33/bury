import type { Metadata } from "next";
import Link from "next/link";
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

      <Link
        href={`/${locale}/help/guide`}
        className="border-leaf-200 bg-leaf-50 hover:border-leaf-400 hover:bg-leaf-100 block rounded-xl2 border p-5 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-leaf-900 font-display text-lg font-semibold">
              {tg("card_cta_title")}
            </h2>
            <p className="text-leaf-800 mt-1 text-sm">{tg("card_cta_body")}</p>
          </div>
          <span
            aria-hidden
            className="bg-leaf-600 mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white"
          >
            {tg("card_cta_button")}
          </span>
        </div>
      </Link>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{t("glossary_title")}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {glossary.map((g) => (
            <div key={g} className="rounded-lg border border-ink-100 bg-white p-3">
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
            <li key={q} className="rounded-lg border border-ink-100 bg-white p-4">
              <details className="group">
                <summary className="cursor-pointer font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                  <span className="bg-leaf-500 mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {t(`faq.${q}.q`)}
                </summary>
                <p className="mt-2 text-sm text-ink-600">{t(`faq.${q}.a`)}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-leaf-50 rounded-xl2 border border-ink-100 p-5">
        <h2 className="text-leaf-900 font-display text-lg font-semibold">{t("contact_title")}</h2>
        <p className="text-leaf-800 mt-1 text-sm">{t("contact_body")}</p>
      </section>
    </div>
  );
}
