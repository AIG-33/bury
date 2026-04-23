import { setRequestLocale, getTranslations } from "next-intl/server";
import { Users, MapPin, Trophy, Settings, Send } from "lucide-react";
import { Link } from "@/i18n/routing";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { listTablesByGroup, type TableDef } from "@/lib/admin/tables";

type Props = { params: Promise<{ locale: string }> };

const GROUP_ICONS: Record<TableDef["group"], React.ComponentType<{ className?: string }>> = {
  people: Users,
  venues: MapPin,
  play: Trophy,
  config: Settings,
  ops: Send,
};

export default async function AdminDbIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminDb");
  const groups = listTablesByGroup();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Admin · Database"
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="admin-db"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <div className="space-y-8">
        {groups.map(({ group, tables }) => {
          const GroupIcon = GROUP_ICONS[group];
          return (
            <section key={group} className="space-y-3">
              <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500">
                <GroupIcon className="h-4 w-4" />
                {t(`groups.${group}`)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((tbl) => (
                  <Link
                    key={tbl.name}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={`/admin/db/${tbl.name}` as any}
                    className="group surface-card-flat block transition hover:-translate-y-0.5 hover:border-grass-300 hover:shadow-[0_18px_44px_-18px_rgba(21,94,54,0.18)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-ink-900">
                        {tbl.label}
                      </h3>
                      <span className="rounded-full bg-grass-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-grass-700">
                        {tbl.name}
                      </span>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
                      {tbl.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
