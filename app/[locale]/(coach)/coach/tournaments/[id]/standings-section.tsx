import type { StandingsLine } from "../actions";

export type StandingsCopy = {
  title: string;
  empty: string;
  col_pos: string;
  col_player: string;
  col_played: string;
  col_wins: string;
  col_losses: string;
  col_sets: string;
  col_games: string;
  col_elo: string;
};

export function StandingsSection({
  rows,
  copy,
}: {
  rows: StandingsLine[];
  copy: StandingsCopy;
}) {
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">{copy.empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                <th className="py-2 pr-2">{copy.col_pos}</th>
                <th className="py-2 pr-2">{copy.col_player}</th>
                <th className="py-2 pr-2 text-center">{copy.col_played}</th>
                <th className="py-2 pr-2 text-center">{copy.col_wins}</th>
                <th className="py-2 pr-2 text-center">{copy.col_losses}</th>
                <th className="py-2 pr-2 text-center">{copy.col_sets}</th>
                <th className="py-2 pr-2 text-center">{copy.col_games}</th>
                <th className="py-2 pr-2 text-center">{copy.col_elo}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.player_id}
                  className="border-b border-ink-50 last:border-b-0"
                >
                  <td className="py-2 pr-2 font-mono font-semibold text-ink-700">
                    {r.position}
                  </td>
                  <td className="py-2 pr-2 text-ink-900">{r.display_name ?? "—"}</td>
                  <td className="py-2 pr-2 text-center text-ink-600">
                    {r.matches_played}
                  </td>
                  <td className="py-2 pr-2 text-center font-semibold text-grass-700">
                    {r.wins}
                  </td>
                  <td className="py-2 pr-2 text-center text-ink-600">{r.losses}</td>
                  <td className="py-2 pr-2 text-center font-mono text-xs text-ink-700">
                    {r.sets_won}–{r.sets_lost}
                  </td>
                  <td className="py-2 pr-2 text-center font-mono text-xs text-ink-700">
                    {r.games_won}–{r.games_lost}
                  </td>
                  <td className="py-2 pr-2 text-center font-mono text-xs text-ink-500">
                    {r.current_elo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
