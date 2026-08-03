import { PlayerNameLink } from "@/components/domain/player-name-link";
import { initialsOf } from "@/lib/mobile/format";

// =============================================================================
// «Итоги» block for a FINISHED tournament — shown right under the hero on
// the public web page and the mobile page. The champion's photo fills the
// whole height of the card on the left, name + labels sit next to it, and
// the runner-up / bronze tiles form a compact column on the right (below the
// champion on narrow screens). Who takes which medal is computed upstream by
// lib/tournaments/podium.ts.
// =============================================================================

export type PodiumPerson = {
  id: string | null;
  /** Composed pair name for doubles; display name for singles. */
  name: string | null;
  avatarUrl: string | null;
  /** Doubles only: the second player of the pair — rendered as a second face. */
  partner?: { name: string | null; avatarUrl: string | null } | null;
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
  const hasMinor = Boolean(runnerUp || third);
  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border border-grass-200/80 bg-gradient-to-br from-grass-50 via-white to-ball-50 shadow-[0_10px_30px_-18px_rgba(18,51,31,0.35)]",
        className ?? "",
      ].join(" ")}
    >
      <div className={mobile ? "flex flex-col" : "flex flex-col sm:flex-row sm:items-stretch"}>
        {/* Champion hero — the photo stretches over the full card height. */}
        <div
          className={`flex min-w-0 flex-1 items-stretch ${
            mobile ? "min-h-[118px]" : "min-h-[124px] sm:min-h-[150px]"
          }`}
        >
          <PodiumHeroAvatar
            person={winner}
            className={mobile ? "w-[108px]" : "w-[116px] sm:w-[150px]"}
          />
          <div
            className={`flex min-w-0 flex-1 flex-col justify-center ${
              mobile ? "px-4 py-3" : "px-5 py-4 sm:px-6"
            }`}
          >
            <p
              className={`font-bold uppercase tracking-[1.4px] text-grass-600 ${
                mobile ? "text-[10.5px]" : "text-[11px]"
              }`}
            >
              {labels.title}
            </p>
            <p
              className={`font-bold uppercase tracking-[1.2px] text-grass-700 ${
                mobile ? "mt-1.5 text-[10px]" : "mt-2 text-[10.5px]"
              }`}
            >
              {labels.champion}
            </p>
            <p
              className={`line-clamp-2 font-display font-extrabold leading-tight text-grass-900 ${
                mobile ? "mt-0.5 text-[19px]" : "mt-1 text-2xl sm:text-[26px]"
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

        {/* Silver / bronze — compact column to the right of the champion
            (below it on narrow screens and on the mobile variant). */}
        {hasMinor && (
          <div
            className={
              mobile
                ? "flex flex-col gap-2 border-t border-grass-100 p-3"
                : "flex flex-col gap-2 border-t border-grass-100 p-3 sm:w-[252px] sm:shrink-0 sm:justify-center sm:border-l sm:border-t-0 sm:p-4"
            }
          >
            {runnerUp && (
              <PodiumMinorRow
                person={runnerUp}
                medal="🥈"
                label={labels.runner_up}
                mobile={mobile}
              />
            )}
            {third && (
              <PodiumMinorRow person={third} medal="🥉" label={labels.third_place} mobile={mobile} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The champion's face(s) filling the full height of the card. Doubles pairs
 * split the zone into two stacked faces. Missing photos degrade to initials
 * on the brand green — same convention as the participant list avatars.
 */
function PodiumHeroAvatar({ person, className }: { person: PodiumPerson; className?: string }) {
  const partner = person.partner ?? null;
  // For pairs `name` is the composed "Captain / Partner" line — the captain's
  // half is everything before the slash.
  const captainName = partner ? (person.name?.split("/")[0]?.trim() ?? null) : person.name;
  return (
    <div className={`relative shrink-0 self-stretch overflow-hidden ${className ?? ""}`}>
      {partner ? (
        <div className="flex h-full flex-col">
          <HeroFace
            name={captainName}
            avatarUrl={person.avatarUrl}
            className="h-1/2 border-b border-white/70"
            initialsClassName="text-[20px]"
          />
          <HeroFace
            name={partner.name}
            avatarUrl={partner.avatarUrl}
            className="h-1/2"
            initialsClassName="text-[20px]"
          />
        </div>
      ) : (
        <HeroFace
          name={captainName}
          avatarUrl={person.avatarUrl}
          className="h-full"
          initialsClassName="text-[30px]"
        />
      )}
      <span
        aria-hidden
        className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[16px] shadow-[0_4px_10px_-4px_rgba(18,51,31,0.5)]"
      >
        🏆
      </span>
    </div>
  );
}

function HeroFace({
  name,
  avatarUrl,
  className,
  initialsClassName,
}: {
  name: string | null;
  avatarUrl: string | null;
  className: string;
  initialsClassName: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`w-full object-cover ${className}`} />
    );
  }
  return (
    <div
      className={`grid w-full place-items-center bg-gradient-to-br from-grass-500 to-grass-700 ${className}`}
    >
      <span className={`font-display font-extrabold text-white ${initialsClassName}`}>
        {initialsOf(name)}
      </span>
    </div>
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
  if (!person.avatarUrl) {
    return (
      <span
        aria-hidden
        style={{ width: px, height: px, fontSize: Math.round(px * 0.34) }}
        className={`grid shrink-0 place-items-center rounded-full bg-grass-100 font-extrabold text-grass-700 ring-2 ${ring}`}
      >
        {initialsOf(person.name)}
      </span>
    );
  }
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
