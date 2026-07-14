import type { Sponsor } from "@/lib/validators/tournament-branding";

// =============================================================================
// SponsorsCarousel — prominent «Партнёры турнира» section shown right under the
// tournament hero (web + mobile shells). Pure CSS scroll-snap, no client JS:
// with 3+ sponsors the row scrolls horizontally with snap points (~2–3 tiles
// per mobile viewport, 3–5 on web); with 1–2 sponsors the tiles are simply
// centered without any carousel affordances. Renders nothing without sponsors.
//
// Clickable tiles open the sponsor site in a new tab; inside the Capacitor
// shell the global NativeBridge click handler intercepts external links and
// routes them to the system browser.
// =============================================================================

type SizeVariant = "web" | "mobile";

const SIZES: Record<
  SizeVariant,
  { tile: string; logoBox: string; logoImg: string; name: string; gap: string }
> = {
  web: {
    tile: "w-[200px] sm:w-[220px] p-5",
    logoBox: "h-24",
    // Fixed max-height: percentage max-h inside an auto grid row is unreliable.
    logoImg: "max-h-24",
    name: "text-sm",
    gap: "gap-4",
  },
  mobile: {
    tile: "w-[156px] p-4",
    logoBox: "h-[76px]",
    logoImg: "max-h-[76px]",
    name: "text-[12.5px]",
    gap: "gap-3",
  },
};

export function SponsorsCarousel({
  sponsors,
  heading,
  accentColor,
  size = "web",
  className = "",
}: {
  sponsors: Sponsor[];
  heading: string;
  accentColor: string | null;
  size?: SizeVariant;
  className?: string;
}) {
  if (sponsors.length === 0) return null;

  const s = SIZES[size];
  const few = sponsors.length <= 2;
  const accent = accentColor ?? "#28A35A";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-ink-100/70 bg-white shadow-[0_1px_2px_rgba(20,60,30,0.04)] ${className}`}
      aria-label={heading}
    >
      <div aria-hidden className="h-1" style={{ backgroundColor: accent }} />
      <div className={size === "web" ? "p-5 sm:p-6" : "p-4"}>
        <h2
          className={`flex items-center gap-2 font-display font-extrabold tracking-tight text-ink-900 ${
            size === "web" ? "text-[18px] md:text-[20px]" : "text-[15px]"
          }`}
        >
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {heading}
        </h2>

        <ul
          className={
            few
              ? `mt-4 flex flex-wrap items-stretch justify-center ${s.gap}`
              : `-mx-1 mt-4 flex snap-x snap-mandatory items-stretch overflow-x-auto px-1 pb-1 ${s.gap} [&::-webkit-scrollbar]:hidden`
          }
          style={few ? undefined : { scrollbarWidth: "none" }}
        >
          {sponsors.map((sponsor, i) => (
            <li key={i} className={few ? "" : "shrink-0 snap-start"}>
              <SponsorTile sponsor={sponsor} sizes={s} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SponsorTile({ sponsor, sizes }: { sponsor: Sponsor; sizes: (typeof SIZES)[SizeVariant] }) {
  const body = (
    <>
      <span className={`grid w-full place-items-center overflow-hidden ${sizes.logoBox}`}>
        {sponsor.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            title={sponsor.name}
            loading="lazy"
            className={`max-w-full object-contain ${sizes.logoImg}`}
          />
        ) : (
          <span className="px-1 text-center font-display text-[17px] font-extrabold leading-tight text-ink-900">
            {sponsor.name}
          </span>
        )}
      </span>
      <span className={`w-full truncate text-center font-bold text-ink-700 ${sizes.name}`}>
        {sponsor.name}
      </span>
    </>
  );

  const tileClass = `flex h-full flex-col items-center gap-2.5 rounded-xl border border-ink-100/80 bg-white shadow-[0_1px_3px_rgba(20,60,30,0.06)] ${sizes.tile}`;

  return sponsor.url ? (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`${tileClass} transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-8px_rgba(20,60,30,0.25)] active:opacity-85`}
    >
      {body}
    </a>
  ) : (
    <div className={tileClass}>{body}</div>
  );
}
