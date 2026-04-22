import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { OnboardingTour, type TourStep } from "@/components/help/onboarding-tour";
import { SetupChecklist, type SetupChecklistStep } from "@/components/help/setup-checklist";
import { loadCoachDashboard } from "./actions";
import { loadCoachJourney, type JourneyStepId } from "@/lib/coach/journey";

type Props = { params: Promise<{ locale: string }> };

const WEEK_LABELS_BY_LOCALE: Record<string, string[]> = {
  pl: ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};

export default async function CoachDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachDashboard");

  const [result, journeyResult] = await Promise.all([loadCoachDashboard(), loadCoachJourney()]);
  if (!result.ok && result.error === "not_authenticated") {
    redirect(`/${locale}/login?next=/coach/dashboard`);
  }
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-rose-600">{t("forbidden")}</p>
      </div>
    );
  }

  const { data } = result;
  const tJourney = await getTranslations("coachJourney");
  const journey = journeyResult.ok ? journeyResult.data : null;

  const checklistSteps: SetupChecklistStep[] = (journey?.steps ?? []).map((s) => {
    const id = s.id as JourneyStepId;
    const ctaKey: "do_now" | "open" | "review" | "browse" =
      s.state === "info"
        ? "browse"
        : s.state === "current"
          ? "do_now"
          : s.state === "future"
            ? "open"
            : "review";
    return {
      id: s.id,
      title: tJourney(`steps.${id}.title`),
      description:
        s.state === "info"
          ? tJourney(`steps.${id}.description_passive`)
          : tJourney(`steps.${id}.description`),
      href: `/${locale}${s.href}`,
      state: s.state,
      count: s.count,
      // For passive/info rows we always render the count badge (even 0),
      // because "0 venues" is itself useful info ("ask the admin").
      countLabel:
        s.state === "info"
          ? tJourney(`steps.${id}.unit`)
          : typeof s.count === "number" && s.count > 0
            ? tJourney(`steps.${id}.unit`)
            : undefined,
      ctaLabel: tJourney(`cta.${ctaKey}`),
    };
  });
  const dayLabels = WEEK_LABELS_BY_LOCALE[locale] ?? WEEK_LABELS_BY_LOCALE.en;
  const fmtTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  const tourSteps: TourStep[] = [
    {
      title: t("tour.s1.title"),
      body: t("tour.s1.body"),
      cta: { label: t("tour.s1.cta"), href: `/${locale}/coach/players` },
    },
    {
      title: t("tour.s2.title"),
      body: t("tour.s2.body"),
      cta: { label: t("tour.s2.cta"), href: `/${locale}/coach/slots` },
    },
    {
      title: t("tour.s3.title"),
      body: t("tour.s3.body"),
      cta: { label: t("tour.s3.cta"), href: `/${locale}/coach/tournaments` },
    },
    {
      title: t("tour.s4.title"),
      body: t("tour.s4.body"),
      cta: { label: t("tour.s4.cta"), href: `/${locale}/coach/profile` },
    },
    {
      title: t("tour.s5.title"),
      body: t("tour.s5.body"),
      cta: { label: t("tour.s5.cta"), href: `/${locale}/help` },
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <OnboardingTour
        storageKey="coach-tour-v1"
        steps={tourSteps}
        closeLabel={t("tour.close")}
        nextLabel={t("tour.next")}
        backLabel={t("tour.back")}
        doneLabel={t("tour.done")}
        stepLabel={t("tour.step")}
      />

      <HelpPanel
        pageId="coach-dashboard"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {journey && (
        <SetupChecklist
          title={tJourney("title")}
          subtitle={journey.isFullySetUp ? tJourney("subtitle_done") : tJourney("subtitle")}
          steps={checklistSteps}
          completed={journey.completed}
          total={journey.total}
          progressLabel={tJourney("progress_label")}
          doneLabel={tJourney("cta.review")}
          completedBadge={tJourney("completed_badge")}
        />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {(
          [
            { k: "players", v: data.kpi.players_active_30d, href: "/coach/players" },
            { k: "tournaments", v: data.kpi.tournaments_active, href: "/coach/tournaments" },
            { k: "bookings", v: data.kpi.bookings_next_7d, href: "/coach/slots" },
            { k: "pending", v: data.kpi.pending_match_confirmations, href: "/coach/matches" },
          ] as const
        ).map(({ k, v, href }) => (
          <Link
            key={k}
            href={`/${locale}${href}`}
            className="hover:border-leaf-300 group rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
              {t(`kpi.${k}.label`)}
            </p>
            <p className="group-hover:text-leaf-700 mt-1 font-mono text-3xl tabular-nums text-ink-900">
              {v}
            </p>
            <p className="mt-1 text-xs text-ink-500">{t(`kpi.${k}.hint`)}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Today's sessions */}
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card md:col-span-2">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">{t("today.title")}</h2>
            <Link href={`/${locale}/coach/slots`} className="text-leaf-700 text-sm hover:underline">
              {t("today.see_all")}
            </Link>
          </header>
          {data.today.length === 0 ? (
            <p className="text-sm text-ink-500">{t("today.empty")}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.today.map((b) => (
                <li key={b.booking_id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-mono tabular-nums text-ink-900">
                      {fmtTime.format(new Date(b.starts_at))}–{fmtTime.format(new Date(b.ends_at))}
                    </span>{" "}
                    <span className="text-ink-700">— {b.player_name ?? "Player"}</span>
                  </div>
                  <span className="text-xs text-ink-500">
                    {b.venue} · {b.court}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 7-day strip */}
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
            {t("week.title")}
          </h2>
          <div className="flex items-end justify-between gap-1">
            {data.next_7_days.map((d, i) => {
              const max = Math.max(1, ...data.next_7_days.map((x) => x.bookings));
              const heightPct = (d.bookings / max) * 100;
              const dayIndex = (new Date(d.date).getDay() + 6) % 7;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end">
                    <div
                      className="bg-leaf-200 w-full rounded-md"
                      style={{ height: `${heightPct}%` }}
                      title={`${d.bookings} ${t("week.bookings_label")}`}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-ink-500">
                    {dayLabels[dayIndex]}
                    {i === 0 ? "*" : ""}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-700">{d.bookings}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-ink-500">{t("week.legend")}</p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending matches */}
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
            {t("pending.title")}
          </h2>
          {data.pending_matches.length === 0 ? (
            <p className="text-sm text-ink-500">{t("pending.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {data.pending_matches.map((m) => (
                <li key={m.id} className="rounded-md border border-ink-100 px-3 py-2 text-sm">
                  <div className="font-medium text-ink-900">
                    {m.opponent_a_name ?? "?"} vs {m.opponent_b_name ?? "?"}
                  </div>
                  {m.note && <div className="mt-1 text-xs text-ink-500">«{m.note}»</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
            {t("activity.title")}
          </h2>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-ink-500">{t("activity.empty")}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.recent_activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-700">
                    <span
                      aria-hidden
                      className="bg-leaf-100 text-leaf-700 mr-2 inline-block w-12 rounded-full px-2 py-0.5 text-center text-[10px] font-medium uppercase"
                    >
                      {a.kind}
                    </span>
                    {a.label}
                  </span>
                  <time className="text-xs text-ink-500" dateTime={a.when}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(a.when))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.kpi.players_active_30d === 0 && (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          ctaLabel={t("empty.cta")}
          ctaHref="/coach/players"
        />
      )}
    </div>
  );
}
