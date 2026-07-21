import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/layout/page-header";
import { Surface, SectionTitle } from "@/components/ui/surface";
import { TelegramIcon } from "@/components/icons/telegram";
import { InstagramIcon } from "@/components/icons/instagram";
import { telegramBotUrl } from "@/lib/telegram/bot-link";
import { INSTAGRAM_URL } from "@/lib/social-links";

type Props = { params: Promise<{ locale: string }> };

type SupportTopic = { heading: string; body: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "supportPage" });
  return {
    title: t("meta_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/support`,
      languages: { ru: "/ru/support", en: "/en/support" },
    },
  };
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("supportPage");
  const botUrl = telegramBotUrl();

  const topics = t.raw("topics") as SupportTopic[];
  const email = t("email");

  return (
    <div className="page-shell space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Surface variant="card" className="space-y-2">
          <h2 className="font-display text-base font-semibold text-grass-900">
            {t("email_title")}
          </h2>
          <p className="text-sm text-ink-600">{t("email_body")}</p>
          <a
            href={`mailto:${email}`}
            className="inline-flex text-sm font-medium text-grass-700 underline underline-offset-2 hover:text-grass-900"
          >
            {email}
          </a>
        </Surface>

        {botUrl && (
          <Surface variant="card" className="space-y-2">
            <h2 className="font-display text-base font-semibold text-grass-900">
              {t("telegram_title")}
            </h2>
            <p className="text-sm text-ink-600">{t("telegram_body")}</p>
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#229ED9] transition-colors hover:text-[#1d8bc0]"
            >
              <TelegramIcon className="h-4 w-4" />
              {t("telegram_cta")}
            </a>
          </Surface>
        )}

        <Surface variant="card" className="space-y-2">
          <h2 className="font-display text-base font-semibold text-grass-900">
            {t("instagram_title")}
          </h2>
          <p className="text-sm text-ink-600">{t("instagram_body")}</p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#E1306C] transition-colors hover:text-[#c02458]"
          >
            <InstagramIcon className="h-4 w-4" />
            {t("instagram_cta")}
          </a>
        </Surface>
      </div>

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>{t("topics_title")}</SectionTitle>
        <div className="space-y-4">
          {topics.map((topic, i) => (
            <div key={i} className="space-y-1">
              <h3 className="font-display text-sm font-semibold text-ink-900">{topic.heading}</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-ink-700">{topic.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="court-line" aria-hidden />

      <Surface variant="soft" as="section" className="space-y-1">
        <h2 className="font-display text-base font-semibold text-grass-900">
          {t("deletion_title")}
        </h2>
        <p className="text-sm text-grass-800">
          {t("deletion_body")}{" "}
          <Link
            href="/account-deletion"
            className="font-medium text-grass-700 underline underline-offset-2 hover:text-grass-900"
          >
            {t("deletion_link")}
          </Link>
          .
        </p>
      </Surface>

      <Surface variant="soft" as="section" className="space-y-1">
        <h2 className="font-display text-base font-semibold text-grass-900">
          {t("privacy_title")}
        </h2>
        <p className="text-sm text-grass-800">
          {t("privacy_body")}{" "}
          <Link
            href="/privacy"
            className="font-medium text-grass-700 underline underline-offset-2 hover:text-grass-900"
          >
            {t("privacy_link")}
          </Link>
        </p>
      </Surface>
    </div>
  );
}
