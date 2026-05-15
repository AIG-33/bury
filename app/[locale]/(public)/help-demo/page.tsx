import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";
import { HelpTooltip } from "@/components/help/help-tooltip";
import { FlowDiagram } from "@/components/help/flow-diagram";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTitle } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

export default async function HelpDemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("helpDemo");

  return (
    <div className="page-shell space-y-10">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="court-line my-2" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>1. HelpPanel</SectionTitle>
        <HelpPanel
          pageId="demo-page"
          why={t("panel.why")}
          what={[t("panel.what.1"), t("panel.what.2"), t("panel.what.3")]}
          result={[t("panel.result.1"), t("panel.result.2")]}
        />
      </section>

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>2. HelpTooltip</SectionTitle>
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

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>3. FlowDiagram (horizontal)</SectionTitle>
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

      <div className="court-line" aria-hidden />

      <section className="space-y-3">
        <SectionTitle>4. EmptyState</SectionTitle>
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
