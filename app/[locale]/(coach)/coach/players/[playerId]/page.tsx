import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  MapPin,
  Minus,
  Trophy,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; playerId: string }> };

type PlayerBasicRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number | null;
  elo_status: "provisional" | "established" | null;
  rated_matches_count: number | null;
  city: string | null;
  district_name: string | null;
  created_at: string | null;
};

type AcceptedInvRow = { accepted_at: string | null; email: string };

type BookingRow = {
  id: string;
  created_at: string;
  status: "pending" | "confirmed" | "cancelled" | "attended" | "no_show";
  paid_status: "unpaid" | "paid" | "comped";
  slots: { starts_at: string | null; ends_at: string | null } | null;
};

type RatingHistoryRow = {
  id: string;
  old_elo: number;
  new_elo: number;
  delta: number;
  k_factor: number;
  reason: "match" | "manual_adjustment" | "onboarding" | "seasonal_decay";
  created_at: string;
  match_id: string | null;
};

type MatchRow = {
  id: string;
  outcome: string;
  played_at: string | null;
  scheduled_at: string | null;
  p1_id: string;
  p2_id: string | null;
  winner_side: "p1" | "p2" | null;
  is_doubles: boolean;
  tournament_id: string | null;
};

export default async function CoachPlayerDetailPage({ params }: Props) {
  const { locale, playerId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachPlayers.detail");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/coach/players/${playerId}`);

  const { data: player } = (await supabase
    .from("public_player_basic")
    .select(
      "id, display_name, avatar_url, current_elo, elo_status, rated_matches_count, " +
        "city, district_name, created_at",
    )
    .eq("id", playerId)
    .maybeSingle()) as { data: PlayerBasicRow | null };

  if (!player) notFound();

  // Coach-side relations: invitation acceptance + bookings to this coach.
  const [invRes, bookingsRes, ratingRes] = await Promise.all([
    supabase
      .from("invitations")
      .select("accepted_at, email")
      .eq("coach_id", user.id)
      .eq("accepted_by", playerId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1) as unknown as Promise<{ data: AcceptedInvRow[] | null }>,
    supabase
      .from("bookings")
      .select(
        "id, created_at, status, paid_status, slots(starts_at, ends_at)",
      )
      .eq("coach_id", user.id)
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(50) as unknown as Promise<{ data: BookingRow[] | null }>,
    supabase
      .from("rating_history")
      .select("id, old_elo, new_elo, delta, k_factor, reason, created_at, match_id")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(20) as unknown as Promise<{ data: RatingHistoryRow[] | null }>,
  ]);

  const acceptedInvite = invRes.data?.[0] ?? null;
  const bookings = bookingsRes.data ?? [];
  const ratingHistory = ratingRes.data ?? [];

  // Matches the coach is allowed to read by RLS:
  //   - matches in tournaments owned by the coach
  //   - matches the coach personally participated in (p1/p2/partners)
  // PostgREST `.or()` handles both conditions.
  const { data: rawMatches } = (await supabase
    .from("matches")
    .select(
      "id, outcome, played_at, scheduled_at, p1_id, p2_id, winner_side, is_doubles, tournament_id",
    )
    .or(`p1_id.eq.${playerId},p2_id.eq.${playerId},p1_partner_id.eq.${playerId},p2_partner_id.eq.${playerId}`)
    .order("played_at", { ascending: false, nullsFirst: false })
    .limit(20)) as { data: MatchRow[] | null };

  const matches = rawMatches ?? [];

  const bookingsActive = bookings.filter((b) => b.status !== "cancelled").length;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const delta30dCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const delta30d = ratingHistory
    .filter((h) => Date.parse(h.created_at) >= delta30dCutoff)
    .reduce((sum, h) => sum + h.delta, 0);

  const isInClub = Boolean(acceptedInvite) || bookings.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <Link
        href={`/${locale}/coach/players`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <Avatar src={player.avatar_url} name={player.display_name ?? "?"} size={64} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {player.display_name ?? t("unknown_name")}
            </h1>
            <HelpPanel
              pageId="coach-player-detail"
              variant="inline"
              why={t("help.why")}
              what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
              result={[t("help.result.1"), t("help.result.2")]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
            {(player.city || player.district_name) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[player.city, player.district_name].filter(Boolean).join(" · ")}
              </span>
            )}
            {acceptedInvite && (
              <span className="inline-flex rounded-full bg-leaf-100 px-2 py-0.5 text-[11px] font-medium text-leaf-800">
                {t("badge_invited")}
              </span>
            )}
            {bookings.length > 0 && (
              <span className="inline-flex rounded-full bg-grass-100 px-2 py-0.5 text-[11px] font-medium text-grass-800">
                {t("badge_booked")}
              </span>
            )}
            {!isInClub && (
              <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {t("badge_not_in_club")}
              </span>
            )}
          </div>
          {acceptedInvite?.email && (
            <p className="text-xs text-ink-500">{acceptedInvite.email}</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat
            label={t("stat_elo")}
            value={player.current_elo?.toString() ?? "—"}
            hint={
              player.elo_status === "provisional" ? t("elo_provisional") : undefined
            }
          />
          <Stat
            label={t("stat_matches")}
            value={(player.rated_matches_count ?? 0).toString()}
          />
          <Stat
            label={t("stat_bookings")}
            value={`${bookingsActive}/${bookings.length}`}
          />
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("rating.title")}
          </h2>
          <span className="text-xs text-ink-500">{t("rating.subtitle_30d")}</span>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                {t("rating.current")}
              </div>
              <div className="font-mono text-3xl font-bold tabular-nums text-ink-900">
                {player.current_elo ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                {t("rating.delta_30d")}
              </div>
              <DeltaPill value={delta30d} large />
            </div>
          </div>

          {ratingHistory.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">{t("rating.empty")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100 text-sm">
              {ratingHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="font-mono tabular-nums text-ink-700">
                      {h.old_elo} → {h.new_elo}
                    </div>
                    <div className="text-xs text-ink-500">
                      {dateFmt.format(new Date(h.created_at))} ·{" "}
                      {t(`rating.reason.${h.reason}`)} · K{h.k_factor}
                    </div>
                  </div>
                  <DeltaPill value={h.delta} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("matches.title")}
        </h2>
        {matches.length === 0 ? (
          <EmptyState
            title={t("matches.empty_title")}
            description={t("matches.empty_description")}
          />
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
            {matches.map((m) => {
              const isP1 = m.p1_id === playerId;
              const won =
                (isP1 && m.winner_side === "p1") ||
                (!isP1 && m.winner_side === "p2");
              const lost =
                m.winner_side &&
                ((isP1 && m.winner_side === "p2") ||
                  (!isP1 && m.winner_side === "p1"));
              const date = m.played_at ?? m.scheduled_at;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-sm text-ink-700">
                      <Trophy className="h-3.5 w-3.5 text-ink-400" />
                      {m.tournament_id ? t("matches.in_tournament") : t("matches.friendly")}
                      {m.is_doubles && (
                        <span className="rounded-full bg-ink-100 px-1.5 text-[10px] uppercase tracking-wider text-ink-600">
                          {t("matches.doubles")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500">
                      {date ? dateTimeFmt.format(new Date(date)) : t("matches.no_date")} ·{" "}
                      {t(`matches.outcome.${m.outcome}`)}
                    </div>
                  </div>
                  {won && (
                    <span className="rounded-full bg-grass-100 px-2 py-0.5 text-xs font-semibold text-grass-800">
                      {t("matches.win")}
                    </span>
                  )}
                  {lost && (
                    <span className="rounded-full bg-clay-100 px-2 py-0.5 text-xs font-semibold text-clay-800">
                      {t("matches.loss")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("bookings.title")}
        </h2>
        {bookings.length === 0 ? (
          <EmptyState
            title={t("bookings.empty_title")}
            description={t("bookings.empty_description")}
          />
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm text-ink-700">
                    <Calendar className="h-3.5 w-3.5 text-ink-400" />
                    {b.slots?.starts_at
                      ? dateTimeFmt.format(new Date(b.slots.starts_at))
                      : dateTimeFmt.format(new Date(b.created_at))}
                  </div>
                  <div className="text-xs text-ink-500">
                    {t(`bookings.status.${b.status}`)} ·{" "}
                    {t(`bookings.paid.${b.paid_status}`)}
                  </div>
                </div>
                <BookingStatusBadge status={b.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Avatar({
  src,
  name,
  size = 36,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700"
    >
      {initials || "?"}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="font-mono text-lg font-bold tabular-nums text-ink-900">
        {value}
      </div>
      {hint && <div className="text-[10px] text-ink-400">{hint}</div>}
    </div>
  );
}

function DeltaPill({ value, large = false }: { value: number; large?: boolean }) {
  const cls = cn(
    "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono font-semibold tabular-nums",
    large ? "text-xl" : "text-[11px]",
  );
  if (value === 0) {
    return (
      <span className={cn(cls, "bg-ink-50 text-ink-500")}>
        <Minus className={large ? "h-5 w-5" : "h-3 w-3"} /> 0
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className={cn(cls, "bg-grass-50 text-grass-800")}>
        <ArrowUp className={large ? "h-5 w-5" : "h-3 w-3"} /> +{value}
      </span>
    );
  }
  return (
    <span className={cn(cls, "bg-clay-50 text-clay-800")}>
      <ArrowDown className={large ? "h-5 w-5" : "h-3 w-3"} /> {value}
    </span>
  );
}

function BookingStatusBadge({
  status,
  t,
}: {
  status: "pending" | "confirmed" | "cancelled" | "attended" | "no_show";
  t: (k: string) => string;
}) {
  const palette: Record<typeof status, string> = {
    pending: "bg-ball-100 text-ball-900",
    confirmed: "bg-leaf-100 text-leaf-800",
    cancelled: "bg-ink-100 text-ink-600",
    attended: "bg-grass-100 text-grass-800",
    no_show: "bg-clay-100 text-clay-800",
  };
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${palette[status]}`}
    >
      {t(`bookings.status.${status}`)}
    </span>
  );
}
