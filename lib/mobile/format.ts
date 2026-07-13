// =============================================================================
// Pure helpers for the mobile app screens (`/[locale]/m/...`).
// Kept UI-free so they are unit-testable (see format.test.ts).
// =============================================================================

/**
 * Compact relative time for feed rows: "5м" / "2ч" / "3д" (ru) or
 * "5m" / "2h" / "3d" (en). Falls back to the short date for anything
 * older than 7 days so the feed never shows "412ч".
 */
export function formatRelativeShort(iso: string, locale: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const ru = locale.startsWith("ru");
  if (minutes < 1) return ru ? "сейчас" : "now";
  if (minutes < 60) return `${minutes}${ru ? "м" : "m"}`;
  if (hours < 24) return `${hours}${ru ? "ч" : "h"}`;
  if (days <= 7) return `${days}${ru ? "д" : "d"}`;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  }).format(new Date(then));
}

/** One set in either of the two shapes stored in `matches.sets` jsonb. */
export type AnySet = {
  p1?: number;
  p2?: number;
  p1_games?: number;
  p2_games?: number;
  tiebreak_p1?: number | null;
  tiebreak_p2?: number | null;
  tb_p1?: number | null;
  tb_p2?: number | null;
};

/**
 * Normalises the two jsonb set shapes (`{p1,p2}` from tournaments,
 * `{p1_games,p2_games}` from friendly matches) into "my:their" pairs.
 */
export function formatSetsScore(
  sets: readonly AnySet[] | null | undefined,
  iAmP1: boolean,
): string {
  if (!sets || sets.length === 0) return "";
  return sets
    .map((s) => {
      const a = s.p1 ?? s.p1_games ?? 0;
      const b = s.p2 ?? s.p2_games ?? 0;
      return iAmP1 ? `${a}:${b}` : `${b}:${a}`;
    })
    .join(" ");
}

/** Generic feed item — page code attaches localized title/meta itself. */
export type MobileFeedEntry<T> = {
  at: string;
  payload: T;
};

/**
 * Merges several already-built feed source arrays, sorts newest-first by
 * `at` and caps the result. Invalid dates sink to the bottom.
 */
export function mergeFeed<T>(
  sources: ReadonlyArray<ReadonlyArray<MobileFeedEntry<T>>>,
  limit: number,
): MobileFeedEntry<T>[] {
  const all = sources.flat();
  all.sort((a, b) => {
    const ta = Date.parse(a.at);
    const tb = Date.parse(b.at);
    const na = Number.isNaN(ta) ? -Infinity : ta;
    const nb = Number.isNaN(tb) ? -Infinity : tb;
    return nb - na;
  });
  return all.slice(0, Math.max(0, limit));
}

/** Win–loss balance + winrate from a list of "did I win" flags. */
export function computeRecord(results: ReadonlyArray<boolean | null>): {
  played: number;
  wins: number;
  losses: number;
  winrate: number | null;
} {
  const decided = results.filter((r): r is boolean => r !== null);
  const wins = decided.filter(Boolean).length;
  const losses = decided.length - wins;
  return {
    played: results.length,
    wins,
    losses,
    winrate: decided.length > 0 ? Math.round((wins / decided.length) * 100) : null,
  };
}

/** Initials for the avatar fallback: "Иван Петров" → "ИП". */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/u).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Compact display name for tight meta tiles: "Максим Горбацевич" → "М. Горбацевич". */
export function shortNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/u);
  if (parts.length < 2) return parts[0] ?? null;
  const [first, ...rest] = parts;
  return `${first[0]?.toUpperCase() ?? ""}. ${rest.join(" ")}`;
}
