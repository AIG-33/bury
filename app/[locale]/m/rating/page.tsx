import { setRequestLocale, getTranslations } from "next-intl/server";
import { Crown } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MAvatar, MContent, MEmptyState, MSegment, MSubHeader } from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadClubRatingBoard } from "@/app/[locale]/clubs/actions";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen «Рейтинг · лидерборд» (design «PlayTennis Screens», экран D).
// Segment Общий / Клуб / Город. Top-3 as a podium on a dark card with a crown
// over the leader; below — rows with rank, ±ELO delta (30 days) and value.
// The viewer's own row is highlighted lime with a «ты» mark.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ seg?: string }>;
};

type BoardRow = {
  id: string;
  name: string | null;
  avatar: string | null;
  elo: number;
  delta: number | null;
};

const BOARD_LIMIT = 30;

export default async function MobileRatingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const seg = sp.seg === "club" ? "club" : sp.seg === "city" ? "city" : "all";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Viewer context for the Клуб / Город segments.
  let myCity: string | null = null;
  let myClubId: string | null = null;
  if (user && seg !== "all") {
    const [profileRes, memberRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("city")
        .eq("id", user.id)
        .maybeSingle() as unknown as Promise<{
        data: { city: string | null } | null;
      }>,
      supabase
        .from("club_members")
        .select("club_id, is_primary")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("is_primary", { ascending: false })
        .limit(1) as unknown as Promise<{ data: Array<{ club_id: string }> | null }>,
    ]);
    myCity = profileRes.data?.city ?? null;
    myClubId = memberRes.data?.[0]?.club_id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Board rows per segment
  // ---------------------------------------------------------------------------
  let rows: BoardRow[] = [];
  let emptyBody: string | null = null;

  if (seg === "club") {
    if (!user) {
      emptyBody = t("common.login_required_body");
    } else if (!myClubId) {
      emptyBody = t("rating.empty_no_club");
    } else {
      const board = await loadClubRatingBoard(myClubId);
      rows = board.standings.slice(0, BOARD_LIMIT).map((s) => ({
        id: s.player_id,
        name: s.display_name,
        avatar: s.avatar_url,
        elo: s.rating,
        delta: null,
      }));
      if (rows.length === 0) emptyBody = t("rating.empty_generic");
    }
  } else if (seg === "city" && (!user || !myCity)) {
    emptyBody = user ? t("rating.empty_no_city") : t("common.login_required_body");
  } else {
    let q = supabase
      .from("public_player_basic")
      .select("id, display_name, avatar_url, current_elo")
      .eq("visible_in_leaderboard", true)
      .order("current_elo", { ascending: false })
      .limit(BOARD_LIMIT);
    if (seg === "city" && myCity) q = q.eq("city", myCity);
    const { data } = (await q) as {
      data: Array<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        current_elo: number;
      }> | null;
    };
    rows = (data ?? []).map((r) => ({
      id: r.id,
      name: r.display_name,
      avatar: r.avatar_url,
      elo: r.current_elo,
      delta: null,
    }));
    if (rows.length === 0) emptyBody = t("rating.empty_generic");
  }

  // 30-day ELO deltas for the visible players (single grouped query).
  if (rows.length > 0) {
    const { data: hist } = (await supabase
      .from("rating_history")
      .select("player_id, delta")
      .in(
        "player_id",
        rows.map((r) => r.id),
      )
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())) as {
      data: Array<{ player_id: string; delta: number }> | null;
    };
    if (hist) {
      const sums = new Map<string, number>();
      for (const h of hist) sums.set(h.player_id, (sums.get(h.player_id) ?? 0) + (h.delta ?? 0));
      rows = rows.map((r) => ({ ...r, delta: sums.get(r.id) ?? 0 }));
    }
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const segHref = (next: string) => `/m/rating${next === "all" ? "" : `?seg=${next}`}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <MSubHeader title={t("rating.title")} backHref="/m/more" backLabel={t("common.back")}>
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("rating.seg_all"), href: segHref("all"), active: seg === "all" },
              { label: t("rating.seg_club"), href: segHref("club"), active: seg === "club" },
              { label: t("rating.seg_city"), href: segHref("city"), active: seg === "city" },
            ]}
          />
        </div>
      </MSubHeader>

      <MContent className="flex-1 pt-4">
        {emptyBody ? (
          <MEmptyState
            title={t("rating.empty_title")}
            body={emptyBody}
            cta={!user && seg !== "all" ? t("common.login") : undefined}
            href={!user && seg !== "all" ? "/login" : undefined}
          />
        ) : (
          <>
            {podium.length === 3 ? (
              <div
                className="relative overflow-hidden rounded-[18px] px-4 pb-4 pt-6 text-white"
                style={{ background: "linear-gradient(135deg,#12331F,#1C6B40 70%,#2A9556)" }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(50% 55% at 50% 0%, rgba(195,232,79,0.18) 0%, transparent 70%)",
                  }}
                />
                <div className="relative grid grid-cols-3 items-end gap-2">
                  <PodiumColumn row={podium[1]} place={2} height={30} />
                  <PodiumColumn row={podium[0]} place={1} height={52} crowned />
                  <PodiumColumn row={podium[2]} place={3} height={22} />
                </div>
              </div>
            ) : null}

            <ul className="mt-3 space-y-[8px]">
              {(podium.length === 3 ? rest : rows).map((row, i) => {
                const rank = (podium.length === 3 ? 4 : 1) + i;
                const isMe = user?.id === row.id;
                return (
                  <li
                    key={row.id}
                    className={[
                      "flex items-center gap-3 rounded-[14px] border px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]",
                      isMe
                        ? "border-ball-600/40 bg-ball-100"
                        : "border-[rgba(20,60,30,0.06)] bg-white",
                    ].join(" ")}
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-[13px] font-bold tabular-nums text-[#8AA093]">
                      {rank}
                    </span>
                    <MAvatar name={row.name} url={row.avatar} size={36} ring={isMe} />
                    <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink-900">
                      {row.name ?? t("common.player_unknown")}
                      {isMe ? (
                        <span className="ml-1.5 text-[11px] font-bold text-grass-600">
                          · {t("rating.you")}
                        </span>
                      ) : null}
                    </p>
                    {row.delta != null && row.delta !== 0 ? (
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold tabular-nums ${
                          row.delta > 0 ? "text-grass-600" : "text-clay-500"
                        }`}
                      >
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </span>
                    ) : null}
                    <span className="shrink-0 font-mono text-[15px] font-bold tabular-nums text-ink-900">
                      {row.elo}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}

function PodiumColumn({
  row,
  place,
  height,
  crowned = false,
}: {
  row: BoardRow;
  place: 1 | 2 | 3;
  height: number;
  crowned?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {crowned ? (
        <Crown className="mb-1 h-[16px] w-[16px] text-ball-500" strokeWidth={2} fill="#C3E84F" />
      ) : null}
      <span
        className="grid place-items-center overflow-hidden rounded-full p-[2.5px]"
        style={{
          background:
            place === 1 ? "linear-gradient(135deg,#C3E84F,#28A35A)" : "rgba(255,255,255,0.22)",
          width: (place === 1 ? 52 : 42) + 5,
          height: (place === 1 ? 52 : 42) + 5,
        }}
      >
        <MAvatar name={row.name} url={row.avatar} size={place === 1 ? 52 : 42} />
      </span>
      <p className="mt-1.5 w-full truncate text-center text-[11px] font-bold text-white/90">
        {row.name ?? "—"}
      </p>
      <p className="font-mono text-[12.5px] font-bold tabular-nums text-ball-500">{row.elo}</p>
      <div
        className="mt-1.5 grid w-full place-items-center rounded-t-[8px] font-mono text-[13px] font-bold text-white/80"
        style={{
          height,
          background: place === 1 ? "rgba(195,232,79,0.28)" : "rgba(255,255,255,0.12)",
        }}
      >
        {place}
      </div>
    </div>
  );
}
