import { PlayerNameLink } from "@/components/domain/player-name-link";

// =============================================================================
// «Итоги» block for a FINISHED tournament — shown right under the hero on
// the public web page and the mobile page. Champion large on top, then the
// runner-up and (when a 3rd-place match was played) the bronze medallist.
// Who takes which medal is computed upstream by lib/tournaments/podium.ts.
// =============================================================================

export type PodiumPerson = {
  id: string | null;
  /** Composed pair name for doubles; display name for singles. */
  name: string | null;
  avatarUrl: string | null;
};

export type TournamentPodiumLabels = {
  title: string;
  champion: string;
  runner_up: string;
  third_place: string;
};

export function TournamentPodium({
  winner,
  runnerUp,
  third,
  labels,
  size = "web",
  className,
}: {
  winner: PodiumPerson;
  runnerUp: PodiumPerson | null;
  third: PodiumPerson | null;
  labels: TournamentPodiumLabels;
  size?: "web" | "mobile";
  className?: string;
}) {
  const mobile = size === "mobile";
  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border border-grass-200/80 bg-gradient-to-br from-grass-50 via-white to-ball-50 shadow-[0_10px_30px_-18px_rgba(18,51,31,0.35)]",
        mobile ? "p-4" : "p-5 sm:p-6",
        className ?? "",
      ].join(" ")}
    >
      <p
        className={`font-bold uppercase tracking-[1.4px] text-grass-600 ${
          mobile ? "text-[10.5px]" : "text-[11px]"
        }`}
      >
        {labels.title}
      </p>

      {/* Champion — the hero line of the block. */}
      <div className={`flex items-center gap-3 ${mobile ? "mt-3" : "mt-4"}`}>
        <span
          aria-hidden
          className={`grid shrink-0 place-items-center rounded-2xl bg-grass-600 shadow-[0_6px_16px_-8px_rgba(28,122,70,0.7)] ${
            mobile ? "h-11 w-11 text-[22px]" : "h-14 w-14 text-[28px]"
          }`}
        >
          🏆
        </span>
        <PodiumAvatar person={winner} px={mobile ? 44 : 56} ring="ring-grass-400" />
        <div className="min-w-0">
          <p
            className={`font-bold uppercase tracking-[1.2px] text-grass-700 ${
              mobile ? "text-[10px]" : "text-[10.5px]"
            }`}
          >
            {labels.champion}
          </p>
          <p
            className={`truncate font-display font-extrabold leading-tight text-grass-900 ${
              mobile ? "text-[19px]" : "text-2xl sm:text-[26px]"
            }`}
          >
            <PlayerNameLink
              id={winner.id}
              name={winner.name}
              className="transition-colors hover:text-grass-700 hover:underline"
            />
          </p>
        </div>
      </div>

      {(runnerUp || third) && (
        <div
          className={`grid gap-2 border-t border-grass-100 ${
            mobile ? "mt-3 pt-3" : "mt-4 pt-4 sm:grid-cols-2"
          }`}
        >
          {runnerUp && (
            <PodiumMinorRow person={runnerUp} medal="🥈" label={labels.runner_up} mobile={mobile} />
          )}
          {third && (
            <PodiumMinorRow person={third} medal="🥉" label={labels.third_place} mobile={mobile} />
          )}
        </div>
      )}
    </section>
  );
}

function PodiumMinorRow({
  person,
  medal,
  label,
  mobile,
}: {
  person: PodiumPerson;
  medal: string;
  label: string;
  mobile: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-grass-100 bg-white/80 px-3 py-2">
      <span aria-hidden className={mobile ? "text-[18px]" : "text-[20px]"}>
        {medal}
      </span>
      <PodiumAvatar person={person} px={mobile ? 32 : 36} ring="ring-grass-200" />
      <div className="min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-ink-400">{label}</p>
        <p
          className={`truncate font-display font-bold leading-tight text-ink-900 ${
            mobile ? "text-[13.5px]" : "text-[15px]"
          }`}
        >
          <PlayerNameLink
            id={person.id}
            name={person.name}
            className="transition-colors hover:text-grass-800 hover:underline"
          />
        </p>
      </div>
    </div>
  );
}

function PodiumAvatar({
  person,
  px,
  ring,
}: {
  person: PodiumPerson;
  px: number;
  ring: string;
}) {
  if (!person.avatarUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatarUrl}
      alt=""
      width={px}
      height={px}
      style={{ width: px, height: px }}
      className={`shrink-0 rounded-full object-cover ring-2 ${ring}`}
    />
  );
}
