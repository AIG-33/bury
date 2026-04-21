import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { HelpCircle, Sliders, Users, Trophy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminOverview");

  const supabase = await createSupabaseServerClient();

  // Pull a few aggregate counts to give the coach an at-a-glance picture.
  const [{ count: players }, { count: coaches }, { count: tournaments }, { data: quizV }, { data: algoV }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_player", true) as unknown as Promise<{ count: number | null }>,
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_coach", true) as unknown as Promise<{ count: number | null }>,
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true }) as unknown as Promise<{ count: number | null }>,
    supabase
      .from("quiz_versions")
      .select("version, is_active")
      .eq("is_active", true)
      .maybeSingle() as unknown as Promise<{ data: { version: number; is_active: boolean } | null }>,
    supabase
      .from("rating_algorithm_config")
      .select("version, is_active")
      .eq("is_active", true)
      .maybeSingle() as unknown as Promise<{ data: { version: number; is_active: boolean } | null }>,
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="admin-overview"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label={t("stat_players")} value={players ?? 0} />
        <Stat icon={Users} label={t("stat_coaches")} value={coaches ?? 0} />
        <Stat icon={Trophy} label={t("stat_tournaments")} value={tournaments ?? 0} />
        <Stat
          icon={HelpCircle}
          label={t("stat_quiz_active")}
          value={quizV?.version ? `v${quizV.version}` : "—"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          icon={HelpCircle}
          href="/admin/quiz"
          title={t("section_quiz_title")}
          description={t("section_quiz_body")}
          activeBadge={
            quizV?.version ? `${t("active_label")}: v${quizV.version}` : t("no_active")
          }
        />
        <SectionCard
          icon={Sliders}
          href="/admin/rating"
          title={t("section_rating_title")}
          description={t("section_rating_body")}
          activeBadge={
            algoV?.version ? `${t("active_label")}: v${algoV.version}` : t("no_active")
          }
        />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  href,
  title,
  description,
  activeBadge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  title: string;
  description: string;
  activeBadge?: string;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className="block rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-ace"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-clay-50 text-clay-700">
          <Icon className="h-5 w-5" />
        </div>
        {activeBadge && (
          <span className="rounded-full bg-grass-50 px-2 py-0.5 text-xs font-medium text-grass-700">
            {activeBadge}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600">{description}</p>
    </Link>
  );
}
