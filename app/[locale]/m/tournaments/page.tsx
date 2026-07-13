import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MContent, MEmptyState, MStickyHeader } from "@/components/mobile/m-ui";
import { MFilterTool, MSearchTool } from "@/components/mobile/m-header-tools";
import {
  loadPublicTournaments,
  loadVenueCities,
  type PublicTournamentRow,
} from "@/app/[locale]/tournaments/actions";
import {
  loadMyTournaments,
  type MyTournamentRow,
} from "@/app/[locale]/(player)/me/tournaments/actions";
import { SURFACES } from "@/lib/tournaments/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";
import { TournamentCard, type CardPillTone } from "./tournament-card";

// =============================================================================
// Screen 02 — Список турниров («Tournaments List» mockup, июль 2026).
// Sticky light header + filter chips (Все / Регистрация / Идут / Мои), the
// catalogue grouped by status («Открыта регистрация → Идут сейчас →
// Завершённые») with full-width immersive cards that carry each tournament's
// own branding (banner/gradient, logo, accent). Filters live in a bottom-sheet.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    q?: string;
    city?: string;
    format?: string;
    surface?: string;
    fee?: string;
  }>;
};

const STATUS_PILL_TONE: Record<string, CardPillTone> = {
  registration: "registration",
  in_progress: "live",
  finished: "finished",
  cancelled: "danger",
};

export default async function MobileTournamentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  // Format labels («Олимпийская», «Группы + плей-офф», …) already live in the
  // public catalogue namespace — reused instead of duplicating.
  const tFormat = await getTranslations("tournamentsPublic.format");

  // Auth state only feeds the burger menu (profile/logout vs login CTA).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tab =
    sp.tab === "reg" ? "reg" : sp.tab === "live" ? "live" : sp.tab === "mine" ? "mine" : "all";
  const status = tab === "reg" ? "registration" : tab === "live" ? "in_progress" : "all";

  const surface = (SURFACES as readonly string[]).includes(sp.surface ?? "")
    ? (sp.surface as (typeof SURFACES)[number])
    : null;
  const fee = sp.fee === "free" || sp.fee === "paid" ? sp.fee : null;

  const [rows, cities, mine] = await Promise.all([
    tab === "mine"
      ? Promise.resolve([] as PublicTournamentRow[])
      : loadPublicTournaments({
          status,
          surface,
          fee,
          city: sp.city ?? null,
        }),
    loadVenueCities(),
    tab === "mine" ? loadMyTournaments() : Promise.resolve(null),
  ]);

  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;

  // Mockup sections: «Открыта регистрация» → «Идут сейчас» → «Завершённые»
  // (cancelled sinks into the finished group, its pill says «Отменён»).
  const registration = filtered.filter((r) => r.status === "registration");
  const live = filtered.filter((r) => r.status === "in_progress");
  const finished = filtered
    .filter((r) => r.status === "finished" || r.status === "cancelled")
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  const order: Record<string, number> = {
    registration: 0,
    in_progress: 1,
    finished: 3,
    cancelled: 4,
  };

  // «Мои»: active tournaments first (live → registration), withdrawn and
  // finished sink to the bottom; newest start date first within each group.
  const mineRows =
    mine && mine.ok
      ? mine.tournaments
          .filter((r) => !q || r.name.toLowerCase().includes(q))
          .sort((a, b) => {
            const rank = (r: MyTournamentRow) => (r.withdrawn ? 10 : 0) + (order[r.status] ?? 9);
            const byRank = rank(a) - rank(b);
            if (byRank !== 0) return byRank;
            return b.starts_on.localeCompare(a.starts_on);
          })
      : [];

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Minsk",
  });
  // "1 авг. 2026 г." → "1 авг 2026" (mockup style).
  const formatDate = (iso: string) =>
    dateFmt
      .format(new Date(iso))
      .replace(/\s*г\.$/u, "")
      .replace(/\./gu, "");

  const cardPropsFor = (row: PublicTournamentRow) => {
    const venue = row.venues[0];
    return {
      href: `/m/tournaments/${row.id}`,
      name: row.name,
      branding: row.branding,
      dateLabel: [formatDate(row.starts_on), row.start_time?.slice(0, 5)]
        .filter(Boolean)
        .join(" · "),
      placeLabel: venue
        ? [venue.name, venue.city].filter(Boolean).join(" · ")
        : t("tournaments.place_tba"),
      formatLabel: tFormat(row.format),
      participantsLabel: row.max_participants
        ? `${row.participants_count} / ${row.max_participants}`
        : null,
      priceLabel: row.entry_fee_byn ? `${row.entry_fee_byn} BYN` : t("tournaments.fee_free"),
      pill: {
        tone: STATUS_PILL_TONE[row.status] ?? ("soon" as CardPillTone),
        label: t(`tournaments.status_${row.status}` as never),
        pulse: row.status === "registration" || row.status === "in_progress",
      },
      muted: row.status === "finished" || row.status === "cancelled",
    };
  };

  const buildTabHref = (nextTab: string) => {
    const next = new URLSearchParams();
    if (nextTab !== "all") next.set("tab", nextTab);
    for (const key of ["q", "city", "format", "surface", "fee"] as const) {
      if (sp[key]) next.set(key, sp[key] as string);
    }
    const qs = next.toString();
    return `/m/tournaments${qs ? `?${qs}` : ""}`;
  };

  const chips = [
    { label: t("tournaments.seg_all"), href: buildTabHref("all"), active: tab === "all" },
    { label: t("tournaments.seg_reg"), href: buildTabHref("reg"), active: tab === "reg" },
    { label: t("tournaments.seg_live"), href: buildTabHref("live"), active: tab === "live" },
    { label: t("tournaments.seg_mine"), href: buildTabHref("mine"), active: tab === "mine" },
  ];

  const sections =
    tab === "all"
      ? [
          {
            key: "registration",
            label: t("tournaments.section_registration"),
            dotClass: "bg-grass-500",
            rows: registration,
          },
          {
            key: "live",
            label: t("tournaments.section_live"),
            dotClass: "bg-ball-600",
            rows: live,
          },
          {
            key: "finished",
            label: t("tournaments.section_finished"),
            dotClass: "bg-ink-300",
            rows: finished,
          },
        ].filter((s) => s.rows.length > 0)
      : [];

  const flatRows = tab === "reg" ? registration : tab === "live" ? live : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <MStickyHeader
        title={t("tournaments.title")}
        actions={
          <>
            <MSearchTool
              placeholder={t("tournaments.search_placeholder")}
              ariaLabel={t("common.search")}
            />
            <MFilterTool
              title={t("common.filters")}
              applyLabel={t("common.apply")}
              resetLabel={t("common.reset")}
              anyLabel={t("common.any")}
              ariaLabel={t("common.filters")}
              groups={[
                {
                  param: "city",
                  label: t("tournaments.filter_city"),
                  options: cities.map((c) => ({ value: c, label: c })),
                },
                {
                  param: "surface",
                  label: t("tournaments.filter_surface"),
                  options: SURFACES.map((s) => ({
                    value: s,
                    label: t(`common.surface_${s}`),
                  })),
                },
                {
                  param: "fee",
                  label: t("tournaments.filter_fee"),
                  options: [
                    { value: "free", label: t("tournaments.fee_free") },
                    { value: "paid", label: t("tournaments.fee_paid") },
                  ],
                },
              ]}
            />
          </>
        }
      >
        {/* Filter chips (mockup): pill row, active chip filled green. */}
        <nav
          className="-mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px]"
          style={{ scrollbarWidth: "none" }}
        >
          {chips.map((chip) => (
            <Link
              key={chip.href}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={chip.href as any}
              scroll={false}
              className={[
                "shrink-0 rounded-full px-[15px] py-[9px] font-display text-[12.5px] font-bold leading-none transition-opacity active:opacity-85",
                chip.active
                  ? "bg-grass-600 text-white shadow-[0_6px_14px_rgba(28,122,70,0.3)]"
                  : "border border-[rgba(20,60,30,0.1)] bg-white text-ink-600",
              ].join(" ")}
            >
              {chip.label}
            </Link>
          ))}
        </nav>
      </MStickyHeader>

      <MContent className="flex-1 pt-4">
        {tab === "mine" ? (
          mine && !mine.ok ? (
            <MEmptyState
              title={t("common.login_required_title")}
              body={t("common.login_required_body")}
              cta={t("common.login")}
              href="/login"
            />
          ) : mineRows.length === 0 ? (
            q ? (
              <MEmptyState
                title={t("tournaments.empty_title")}
                body={t("tournaments.empty_body")}
                cta={t("tournaments.seg_all")}
                href="/m/tournaments"
              />
            ) : (
              <MEmptyState
                title={t("tournaments.empty_mine_title")}
                body={t("tournaments.empty_mine_body")}
                cta={t("tournaments.empty_mine_cta")}
                href="/m/tournaments?tab=reg"
              />
            )
          ) : (
            <ul className="space-y-[12px]">
              {mineRows.map((row) => (
                <li key={row.id}>
                  <MyTournamentCard row={row} t={t} tFormat={tFormat} formatDate={formatDate} />
                </li>
              ))}
            </ul>
          )
        ) : tab === "all" ? (
          sections.length === 0 ? (
            <MEmptyState
              title={t("tournaments.empty_title")}
              body={t("tournaments.empty_body")}
              cta={t("tournaments.seg_all")}
              href="/m/tournaments"
            />
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <section key={section.key}>
                  <div className="mb-2.5 flex items-baseline gap-2">
                    <span
                      className={`h-[7px] w-[7px] shrink-0 self-center rounded-full ${section.dotClass}`}
                      aria-hidden
                    />
                    <h2 className="font-display text-[13.5px] font-extrabold text-grass-900">
                      {section.label}
                    </h2>
                    <span className="text-[12px] font-bold tabular-nums text-ink-400">
                      · {section.rows.length}
                    </span>
                  </div>
                  <ul className="space-y-[12px]">
                    {section.rows.map((row) => (
                      <li key={row.id}>
                        <TournamentCard {...cardPropsFor(row)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )
        ) : flatRows.length === 0 ? (
          <MEmptyState
            title={t("tournaments.empty_title")}
            body={t("tournaments.empty_body")}
            cta={t("tournaments.seg_all")}
            href="/m/tournaments"
          />
        ) : (
          <ul className="space-y-[12px]">
            {flatRows.map((row) => (
              <li key={row.id}>
                <TournamentCard {...cardPropsFor(row)} />
              </li>
            ))}
          </ul>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}

function MyTournamentCard({
  row,
  t,
  tFormat,
  formatDate,
}: {
  row: MyTournamentRow;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
  tFormat: Awaited<ReturnType<typeof getTranslations<"tournamentsPublic.format">>>;
  formatDate: (iso: string) => string;
}) {
  const inactive = row.withdrawn || row.status === "finished" || row.status === "cancelled";

  // Pill: application state first (pending / rejected / withdrawn), otherwise
  // the tournament status — same tones as the public catalogue cards.
  const pill = row.withdrawn
    ? { tone: "finished" as CardPillTone, label: t("tournaments.mine_withdrawn"), pulse: false }
    : row.application_status === "pending"
      ? { tone: "soon" as CardPillTone, label: t("tournaments.mine_pending"), pulse: false }
      : row.application_status === "rejected"
        ? { tone: "danger" as CardPillTone, label: t("tournaments.mine_rejected"), pulse: false }
        : {
            tone: STATUS_PILL_TONE[row.status] ?? ("soon" as CardPillTone),
            label: t(`tournaments.status_${row.status}` as never),
            pulse: row.status === "registration" || row.status === "in_progress",
          };

  const nextMatch =
    !row.withdrawn && row.next_match?.opponent_name
      ? t("tournaments.mine_next_match", { opponent: row.next_match.opponent_name })
      : null;

  const venue = row.venues[0];

  return (
    <TournamentCard
      href={`/m/tournaments/${row.id}`}
      name={row.name}
      branding={row.branding}
      pill={pill}
      dateLabel={[formatDate(row.starts_on), row.start_time?.slice(0, 5)]
        .filter(Boolean)
        .join(" · ")}
      placeLabel={
        venue
          ? [venue.name, venue.city].filter(Boolean).join(" · ")
          : (row.organizer_name ?? t("tournaments.place_tba"))
      }
      formatLabel={tFormat(row.format)}
      participantsLabel={
        row.max_participants ? `${row.participants_count} / ${row.max_participants}` : null
      }
      priceLabel={row.entry_fee_byn ? `${row.entry_fee_byn} BYN` : t("tournaments.fee_free")}
      extraMeta={nextMatch}
      muted={inactive}
    />
  );
}
