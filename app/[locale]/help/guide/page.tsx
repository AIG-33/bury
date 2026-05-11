import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";

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
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-8">
      <header className="space-y-2">
        <Link href={`/${locale}/help`} className="text-leaf-700 text-sm hover:underline">
          {t("back_to_help")}
        </Link>
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <section className="bg-leaf-50 rounded-xl2 border border-ink-100 p-5">
        <h2 className="text-leaf-900 font-display text-lg font-semibold">{t("intro_title")}</h2>
        <ul className="text-leaf-900 mt-2 list-disc space-y-1 pl-5 text-sm">
          {introBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <nav
        aria-label={t("section_index_title")}
        className="rounded-lg border border-ink-100 bg-white p-4"
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-700">
          {t("section_index_title")}
        </h2>
        <ol className="text-leaf-700 mt-2 grid gap-1 text-sm sm:grid-cols-2">
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
          <h2 className="font-display text-2xl font-semibold text-ink-900">
            {idx + 1}. {section.title}
          </h2>
          {section.intro ? <p className="text-sm text-ink-600">{section.intro}</p> : null}
          <div className="space-y-3">
            {section.flows.map((flow) => (
              <article key={flow.id} className="rounded-lg border border-ink-100 bg-white p-4">
                <h3 className="font-display text-base font-semibold text-ink-900">{flow.title}</h3>
                <p className="mt-1 text-sm italic text-ink-600">{flow.auto}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-800">
                  {flow.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{t("auto_title")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
          {autoBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{t("missing_title")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
          {missingBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="bg-leaf-50 rounded-xl2 border border-ink-100 p-5">
        <h2 className="text-leaf-900 font-display text-lg font-semibold">{t("where_title")}</h2>
        <p className="text-leaf-800 mt-1 text-sm">{t("where_body")}</p>
        <Link
          href={`/${locale}/help`}
          className="text-leaf-700 mt-3 inline-block text-sm font-semibold hover:underline"
        >
          {t("back_to_help")}
        </Link>
      </section>
    </div>
  );
}
