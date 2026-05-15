import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Surface, SectionTitle } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string }> };

type GuideFlow = {
  id: string;
  title: string;
  auto: string;
  steps: string[];
};

type GuideSection = {
  id: string;
  title: string;
  intro?: string;
  flows: GuideFlow[];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guidePage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/help/guide`,
      languages: {
        ru: "/ru/help/guide",
        en: "/en/help/guide",
      },
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guidePage");

  const introBullets = t.raw("intro_bullets") as string[];
  const sections = t.raw("sections") as GuideSection[];
  const autoBullets = t.raw("auto_bullets") as string[];
  const missingBullets = t.raw("missing_bullets") as string[];

  return (
    <div className="page-shell space-y-10">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/help`}>
            <ArrowLeft className="h-3 w-3" />
            {t("back_to_help")}
          </Link>
        </Button>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
      </div>

      <Surface variant="soft" as="section">
        <h2 className="font-display text-lg font-semibold text-grass-900">{t("intro_title")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-800">
          {introBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </Surface>

      <nav
        aria-label={t("section_index_title")}
        className="surface-card"
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-700">
          {t("section_index_title")}
        </h2>
        <ol className="mt-2 grid gap-1 text-sm text-grass-700 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, idx) => (
        <section key={section.id} id={section.id} className="scroll-mt-20 space-y-4">
          <SectionTitle>
            {idx + 1}. {section.title}
          </SectionTitle>
          {section.intro ? <p className="text-sm text-ink-600">{section.intro}</p> : null}
          <div className="space-y-3">
            {section.flows.map((flow) => (
              <Surface variant="row" as="article" key={flow.id}>
                <h3 className="font-display text-base font-semibold text-grass-900">{flow.title}</h3>
                <p className="mt-1 text-sm italic text-ink-600">{flow.auto}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-800">
                  {flow.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </Surface>
            ))}
          </div>
        </section>
      ))}

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>{t("auto_title")}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
          {autoBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>{t("missing_title")}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
          {missingBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <Surface variant="soft" as="section">
        <h2 className="font-display text-lg font-semibold text-grass-900">{t("where_title")}</h2>
        <p className="mt-1 text-sm text-grass-800">{t("where_body")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-3 px-0">
          <Link href={`/${locale}/help`}>{t("back_to_help")}</Link>
        </Button>
      </Surface>
    </div>
  );
}
