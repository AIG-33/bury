import Link from "next/link";
import { Users } from "lucide-react";
import type { ClubStandingRow } from "@/app/[locale]/clubs/actions";

type Labels = {
  rank: string;
  player: string;
  rating: string;
  matches: string;
  record: string;
  provisional: string;
};

/**
 * Presentational club standings table. Ratings use tabular-nums per AGENTS.md.
 * Pure server-render friendly — receives already-translated labels.
 */
export function ClubRatingTable({
  rows,
  locale,
  labels,
  brandColor,
}: {
  rows: ClubStandingRow[];
  locale: string;
  labels: Labels;
  brandColor?: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-ink-500">
            <th className="px-2 py-2 font-medium">{labels.rank}</th>
            <th className="px-2 py-2 font-medium">{labels.player}</th>
            <th className="px-2 py-2 text-right font-medium">{labels.rating}</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
              {labels.matches}
            </th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
              {labels.record}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.player_id}
              className="border-b border-ink-50 transition hover:bg-ink-50/50"
            >
              <td className="px-2 py-2">
                {/* Spec §2.3: rank 1–3 gets a lime badge, the rest stay neutral. */}
                <span
                  className={`inline-grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold tabular-nums ${
                    i < 3 ? "bg-pt-lime text-[#123320]" : "bg-ink-50 text-ink-500"
                  }`}
                  style={
                    i < 3 && brandColor
                      ? { backgroundImage: "none", backgroundColor: `${brandColor}22`, color: brandColor }
                      : undefined
                  }
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-2 py-2">
                <Link
                  href={`/${locale}/players/${r.player_id}`}
                  className="group flex items-center gap-2"
                >
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full border border-ink-100 object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="truncate font-medium text-ink-900 group-hover:text-grass-800">
                    {r.display_name ?? "—"}
                  </span>
                  {r.rating_status === "provisional" && (
                    <span className="rounded bg-ball-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-ball-700">
                      {labels.provisional}
                    </span>
                  )}
                </Link>
              </td>
              <td className="px-2 py-2 text-right font-mono text-base font-bold tabular-nums text-ink-900">
                {r.rating}
              </td>
              <td className="hidden px-2 py-2 text-right font-mono tabular-nums text-ink-600 sm:table-cell">
                {r.rated_matches_count}
              </td>
              <td className="hidden px-2 py-2 text-right font-mono tabular-nums text-ink-600 sm:table-cell">
                {r.wins}–{r.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
