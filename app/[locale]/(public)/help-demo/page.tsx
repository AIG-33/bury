import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";
import { HelpTooltip } from "@/components/help/help-tooltip";
import { FlowDiagram } from "@/components/help/flow-diagram";
import { EmptyState } from "@/components/help/empty-state";

type Props = { params: Promise<{ locale: string }> };

export default async function HelpDemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("helpDemo");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">
          1. HelpPanel
        </h2>
        <HelpPanel
          pageId="demo-page"
          why={t("panel.why")}
          what={[t("panel.what.1"), t("panel.what.2"), t("panel.what.3")]}
          result={[t("panel.result.1"), t("panel.result.2")]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">
          2. HelpTooltip
        </h2>
        <p className="text-sm text-ink-700">
          {t("tooltip.intro")}{" "}
          <span className="inline-flex items-center gap-1 font-medium">
            K-фактор <HelpTooltip term="k_factor" />
          </span>
          ,{" "}
          <span className="inline-flex items-center gap-1 font-medium">
            super-tiebreak <HelpTooltip term="super_tiebreak" />
          </span>
          ,{" "}
          <span className="inline-flex items-center gap-1 font-medium">
            no-ad <HelpTooltip term="no_ad" />
          </span>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">
          3. FlowDiagram (horizontal)
        </h2>
        <FlowDiagram
          currentStep={2}
          steps={[
            { id: "basic", label: t("flow.steps.1") },
            { id: "format", label: t("flow.steps.2") },
            { id: "rules", label: t("flow.steps.3") },
            { id: "players", label: t("flow.steps.4") },
            { id: "confirm", label: t("flow.steps.5") },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">
          4. EmptyState
        </h2>
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          ctaLabel={t("empty.cta")}
          ctaHref="/"
        />
      </section>
    </div>
  );
}
