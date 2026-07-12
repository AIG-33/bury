import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

type DeletionSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "accountDeletionPage" });
  return {
    title: t("meta_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/account-deletion`,
      languages: { ru: "/ru/account-deletion", en: "/en/account-deletion" },
    },
  };
}

export default async function AccountDeletionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("accountDeletionPage");

  const sections = t.raw("sections") as DeletionSection[];
  const email = t("email");
  const subject = encodeURIComponent(t("email_subject"));

  return (
    <div className="page-shell space-y-6">
      <PageHeader title={t("title")} subtitle={t("updated")} />

      <p className="max-w-3xl text-sm leading-relaxed text-ink-700">{t("intro")}</p>

      <div className="court-line" aria-hidden />

      <div className="space-y-6">
        {sections.map((section, i) => (
          <section key={i} className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-grass-900">{section.heading}</h2>
            {section.paragraphs?.map((p, j) => (
              <p key={j} className="max-w-3xl text-sm leading-relaxed text-ink-700">
                {p}
              </p>
            ))}
            {section.items && (
              <ul className="ml-1 space-y-1.5 text-sm text-ink-700">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-grass-500"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="court-line" aria-hidden />

      <Surface variant="soft" as="section" className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-grass-900">{t("cta_heading")}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-grass-800">{t("cta_body")}</p>
        <p className="text-sm">
          <a
            href={`mailto:${email}?subject=${subject}`}
            className="font-medium text-grass-700 underline underline-offset-2 hover:text-grass-900"
          >
            {email}
          </a>
        </p>
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
