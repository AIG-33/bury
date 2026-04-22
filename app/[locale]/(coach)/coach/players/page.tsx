import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  MapPin,
  Minus,
  Trophy,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { HelpTooltip } from "@/components/help/help-tooltip";
import { EmptyState } from "@/components/help/empty-state";
import { InviteForm } from "./invite-form";
import { loadCoachLeaderboard } from "../leaderboard/actions";
import { LeaderboardTabs } from "../leaderboard/leaderboard-tabs";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lb?: string }>;
};

type InvitationListRow = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
};

type AcceptedInvitationRow = {
  accepted_by: string;
  accepted_at: string | null;
  email: string;
};

type BookingRow = {
  player_id: string;
  created_at: string;
  status: "pending" | "confirmed" | "cancelled" | "attended" | "no_show";
};

type PlayerBasicRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number | null;
  elo_status: "provisional" | "established" | null;
  rated_matches_count: number | null;
  city: string | null;
  district_name: string | null;
};

type ClubPlayer = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  current_elo: number | null;
  elo_status: "provisional" | "established" | null;
  rated_matches_count: number;
  city: string | null;
  district_name: string | null;
  invited: boolean;
  booked: boolean;
  bookings_total: number;
  bookings_active: number;
  last_activity_at: string;
};

function emptyClubPlayer(id: string, last_activity_at = ""): ClubPlayer {
  return {
    id,
    display_name: "",
    avatar_url: null,
    email: null,
    current_elo: null,
    elo_status: null,
    rated_matches_count: 0,
    city: null,
    district_name: null,
    invited: false,
    booked: false,
    bookings_total: 0,
    bookings_active: 0,
    last_activity_at,
  };
}

export default async function CoachPlayersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachPlayers");
  const tLb = await getTranslations("coachLeaderboard");

  const sp = await searchParams;
  const lbScope: "mine" | "all" = sp.lb === "all" ? "all" : "mine";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [invitesRes, acceptedRes, bookingsRes] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, status, expires_at, created_at")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20) as unknown as Promise<{ data: InvitationListRow[] | null }>,
    supabase
      .from("invitations")
      .select("accepted_by, accepted_at, email")
      .eq("coach_id", user.id)
      .eq("status", "accepted")
      .not("accepted_by", "is", null) as unknown as Promise<{
      data: AcceptedInvitationRow[] | null;
    }>,
    supabase
      .from("bookings")
      .select("player_id, created_at, status")
      .eq("coach_id", user.id) as unknown as Promise<{ data: BookingRow[] | null }>,
  ]);

  const invites = invitesRes.data;
  const accepted = acceptedRes.data ?? [];
  const bookings = bookingsRes.data ?? [];

  const players = new Map<string, ClubPlayer>();

  for (const inv of accepted) {
    if (!inv.accepted_by) continue;
    const cur = players.get(inv.accepted_by) ?? emptyClubPlayer(inv.accepted_by);
    cur.invited = true;
    cur.email = cur.email ?? inv.email ?? null;
    if (inv.accepted_at && inv.accepted_at > cur.last_activity_at) {
      cur.last_activity_at = inv.accepted_at;
    }
    players.set(inv.accepted_by, cur);
  }

  for (const b of bookings) {
    const cur = players.get(b.player_id) ?? emptyClubPlayer(b.player_id, b.created_at);
    cur.booked = true;
    cur.bookings_total += 1;
    if (b.status !== "cancelled") cur.bookings_active += 1;
    if (b.created_at > cur.last_activity_at) cur.last_activity_at = b.created_at;
    players.set(b.player_id, cur);
  }

  const ids = Array.from(players.keys());
  if (ids.length > 0) {
    const { data: profs } = (await supabase
      .from("public_player_basic")
      .select(
        "id, display_name, avatar_url, current_elo, elo_status, rated_matches_count, city, district_name",
      )
      .in("id", ids)) as { data: PlayerBasicRow[] | null };
    for (const p of profs ?? []) {
      const cur = players.get(p.id);
      if (cur) {
        cur.display_name = p.display_name ?? "";
        cur.avatar_url = p.avatar_url ?? null;
        cur.current_elo = p.current_elo;
        cur.elo_status = p.elo_status;
        cur.rated_matches_count = p.rated_matches_count ?? 0;
        cur.city = p.city;
        cur.district_name = p.district_name;
      }
    }
  }

  const playerList = Array.from(players.values()).sort((a, b) =>
    b.last_activity_at.localeCompare(a.last_activity_at),
  );

  const lb = await loadCoachLeaderboard({ scope: lbScope });
  const lbRows = lb.ok ? lb.rows : [];
  const lbTotalMine = lb.ok ? lb.total_my_players : 0;
  const lbTotalAll = lb.ok ? lb.total_directory : 0;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-players"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {t("club.title")}
            </h2>
            <p className="text-sm text-ink-600">{t("club.subtitle")}</p>
          </div>
          <span className="font-mono text-sm tabular-nums text-ink-700">
            {t("club.count", { n: playerList.length })}
          </span>
        </div>

        {playerList.length === 0 ? (
          <EmptyState
            title={t("club.empty_title")}
            description={t("club.empty_description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_player")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium sm:px-4">
                    {t("club.col_elo")}
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell sm:px-4">
                    {t("club.col_matches")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_source")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">
                    {t("club.col_sessions")}
                  </th>
                  <th className="hidden px-3 py-2 text-left font-medium md:table-cell md:px-4">
                    {t("club.col_last")}
                  </th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {playerList.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition hover:bg-ink-50/60 focus-within:bg-ink-50"
                  >
                    <td className="px-3 py-2 sm:px-4">
                      <Link
                        href={`/${locale}/coach/players/${p.id}`}
                        className="flex items-center gap-3 focus:outline-none"
                      >
                        <Avatar src={p.avatar_url} name={p.display_name || p.email || "?"} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink-900">
                            {p.display_name || t("club.unknown_name")}
                          </div>
                          {(p.city || p.district_name) && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                              <MapPin className="h-3 w-3" />
                              {[p.city, p.district_name].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          {p.email && (
                            <div className="truncate text-xs text-ink-500">{p.email}</div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-base font-semibold tabular-nums text-ink-900 sm:px-4">
                      {p.current_elo ?? "—"}
                      {p.elo_status === "provisional" && (
                        <div className="text-[10px] font-normal uppercase tracking-wider text-ink-400">
                          {t("club.elo_provisional")}
                        </div>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-ink-600 sm:table-cell sm:px-4">
                      {p.rated_matches_count}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.invited && (
                          <span className="inline-flex rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-800">
                            {t("club.source_invited")}
                          </span>
                        )}
                        {p.booked && (
                          <span className="inline-flex rounded-full bg-grass-100 px-2 py-0.5 text-xs font-medium text-grass-800">
                            {t("club.source_booked")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-ink-700 sm:px-4">
                      {p.booked
                        ? t("club.sessions_value", {
                            active: p.bookings_active,
                            total: p.bookings_total,
                          })
                        : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-ink-500 md:table-cell md:px-4">
                      {p.last_activity_at
                        ? dateFmt.format(new Date(p.last_activity_at))
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-ink-400">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {tLb("title")}
          </h2>
          <p className="text-sm text-ink-600">{tLb("subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <LeaderboardTabs
            active={lbScope}
            totalMine={lbTotalMine}
            totalAll={lbTotalAll}
            basePath="/coach/players"
            paramName="lb"
            copy={{ tab_mine: tLb("tab_mine"), tab_all: tLb("tab_all") }}
          />
          <p className="text-xs text-ink-500">{tLb("note_recent_30d")}</p>
        </div>

        {lbRows.length === 0 ? (
          <EmptyState
            title={lbScope === "mine" ? tLb("empty_mine_title") : tLb("empty_all_title")}
            description={
              lbScope === "mine"
                ? tLb("empty_mine_description")
                : tLb("empty_all_description")
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-white shadow-card">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-grass-50 text-xs uppercase tracking-wider text-grass-800">
                <tr>
                  <th className="w-10 py-3 pl-4 text-left">{tLb("col_rank")}</th>
                  <th className="py-3 text-left">{tLb("col_player")}</th>
                  <th className="py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      {tLb("col_elo")}
                      <HelpTooltip term="k_factor" />
                    </span>
                  </th>
                  <th className="hidden py-3 text-right md:table-cell">
                    {tLb("col_matches")}
                  </th>
                  <th className="hidden py-3 text-right sm:table-cell">
                    {tLb("col_delta_7d")}
                  </th>
                  <th className="py-3 pr-4 text-right">{tLb("col_delta_30d")}</th>
                </tr>
              </thead>
              <tbody>
                {lbRows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="py-3 pl-4 align-middle">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="py-3 align-middle">
                      <Link
                        href={`/${locale}/coach/players/${r.id}`}
                        className="flex min-w-0 items-center gap-2 hover:opacity-80"
                      >
                        {r.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-100"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ball-100 text-xs font-semibold text-ball-800">
                            {(r.display_name ?? "?").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">
                            {r.display_name ?? "—"}
                            {r.is_my_player && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-grass-100 px-1.5 py-0 text-[9px] font-semibold uppercase text-grass-800">
                                {tLb("my_player_badge")}
                              </span>
                            )}
                          </p>
                          {(r.city || r.district_name) && (
                            <p className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                              <MapPin className="h-3 w-3" />
                              {[r.city, r.district_name].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 text-right align-middle">
                      <span className="font-mono text-base font-semibold text-ink-900">
                        {r.current_elo}
                      </span>
                      {r.elo_status === "provisional" && (
                        <p className="text-[10px] uppercase tracking-wider text-ink-400">
                          {tLb("provisional")}
                        </p>
                      )}
                    </td>
                    <td className="hidden py-3 text-right align-middle text-ink-600 md:table-cell">
                      {r.rated_matches_count}
                    </td>
                    <td className="hidden py-3 text-right align-middle sm:table-cell">
                      <DeltaPill value={r.delta_7d} />
                    </td>
                    <td className="py-3 pr-4 text-right align-middle">
                      <DeltaPill value={r.delta_30d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("invite.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("invite.subtitle")}</p>
        <div className="mt-4">
          <InviteForm
            copy={{
              email: t("invite.email"),
              first_name: t("invite.first_name"),
              last_name: t("invite.last_name"),
              cta: t("invite.cta"),
              sending: t("invite.sending"),
              sent: t("invite.sent"),
              dev_link_label: t("invite.dev_link_label"),
              error: t("invite.error"),
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("recent.title")}
        </h2>

        {!invites || invites.length === 0 ? (
          <EmptyState
            title={t("recent.empty_title")}
            description={t("recent.empty_description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_email")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_status")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_expires")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="break-all px-3 py-2 text-ink-900 sm:px-4">{i.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <StatusBadge status={i.status} labels={{
                        pending: t("status.pending"),
                        accepted: t("status.accepted"),
                        expired: t("status.expired"),
                        revoked: t("status.revoked"),
                      }} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500 sm:px-4">
                      {dateFmt.format(new Date(i.expires_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
      {initials || "?"}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-ball-200 text-ball-900 ring-2 ring-ball-300"
      : rank === 2
        ? "bg-ink-200 text-ink-800 ring-2 ring-ink-300"
        : rank === 3
          ? "bg-clay-200 text-clay-900 ring-2 ring-clay-300"
          : "bg-ink-50 text-ink-600";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${cls}`}
    >
      {rank <= 3 ? <Trophy className="h-3 w-3" /> : rank}
    </span>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-500">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-grass-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-grass-800">
        <ArrowUp className="h-3 w-3" /> +{value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-clay-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-clay-800">
      <ArrowDown className="h-3 w-3" /> {value}
    </span>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: "pending" | "accepted" | "expired" | "revoked";
  labels: Record<"pending" | "accepted" | "expired" | "revoked", string>;
}) {
  const palette: Record<typeof status, string> = {
    pending: "bg-ball-100 text-ball-900",
    accepted: "bg-grass-100 text-grass-800",
    expired: "bg-ink-100 text-ink-600",
    revoked: "bg-clay-100 text-clay-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status]}`}>
      {labels[status]}
    </span>
  );
}
