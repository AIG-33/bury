"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Sponsor } from "@/lib/validators/tournament-branding";

// =============================================================================
// SponsorsCarousel — prominent «Партнёры турнира» section shown right under the
// tournament hero (web + mobile shells). With 1–2 sponsors the tiles are simply
// centered without any carousel affordances. With 3+ sponsors the behaviour
// depends on width: when every tile fits the container the row stays static;
// when the row overflows it turns into an infinite marquee — the tile set is
// duplicated and slid left by exactly one set width via a CSS keyframe
// animation (seamless loop, ~35 px/s, paused on hover). Users with
// prefers-reduced-motion get the static scroll-snap row instead.
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

const MARQUEE_SPEED_PX_PER_SEC = 35;

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
  const listRef = useRef<HTMLUListElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Distance (px) between the first tile of set #1 and the first tile of the
  // duplicated set #2 — the exact translateX for a seamless loop. Null until
  // the duplicated set has been rendered and measured.
  const [shift, setShift] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const few = sponsors.length <= 2;
  const marquee = !few && overflowing && !reducedMotion;

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    // In static mode the ul scrolls, so scrollWidth is the one-set content
    // width. In marquee mode the duplicated set doubles scrollWidth — use the
    // offset between the two set starts instead (also captures the flex gap).
    const items = list.children;
    const duplicated = items.length === sponsors.length * 2;
    const container = list.parentElement;
    if (duplicated) {
      const first = items[0] as HTMLElement;
      const twin = items[sponsors.length] as HTMLElement;
      const setWidth = twin.offsetLeft - first.offsetLeft;
      setShift(setWidth);
      // Keep the overflow check alive so widening the container drops the
      // carousel back to the static row. setWidth includes the trailing gap,
      // which adds a little hysteresis against flapping at the boundary.
      if (container) setOverflowing(setWidth > container.clientWidth + 1);
    } else if (container) {
      setOverflowing(list.scrollWidth > container.clientWidth + 1);
    }
  }, [sponsors.length]);

  useEffect(() => {
    if (few) return;
    const list = listRef.current;
    if (!list) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    if (list.parentElement) ro.observe(list.parentElement);
    // Logo loads change tile widths after mount — remeasure per image too.
    for (const img of Array.from(list.querySelectorAll("img"))) {
      img.addEventListener("load", measure);
    }
    return () => {
      ro.disconnect();
      for (const img of Array.from(list.querySelectorAll("img"))) {
        img.removeEventListener("load", measure);
      }
    };
  }, [few, marquee, measure]);

  if (sponsors.length === 0) return null;

  const s = SIZES[size];
  const accent = accentColor ?? "#28A35A";

  const items = marquee ? [...sponsors, ...sponsors] : sponsors;
  const animationReady = marquee && shift != null && shift > 0;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-ink-100/70 bg-white shadow-[0_1px_2px_rgba(20,60,30,0.04)] ${className}`}
      aria-label={heading}
    >
      <style>{`@keyframes sponsors-marquee { from { transform: translateX(0); } to { transform: translateX(calc(var(--sponsors-marquee-shift, 0px) * -1)); } }`}</style>
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

        <div className={marquee ? "-mx-1 mt-4 overflow-hidden px-1 pb-1" : undefined}>
          <ul
            ref={listRef}
            className={
              few
                ? `mt-4 flex flex-wrap items-stretch justify-center ${s.gap}`
                : marquee
                  ? `flex w-max items-stretch ${s.gap} hover:[animation-play-state:paused]`
                  : `-mx-1 mt-4 flex snap-x snap-mandatory items-stretch overflow-x-auto px-1 pb-1 ${s.gap} [&::-webkit-scrollbar]:hidden`
            }
            style={
              few
                ? undefined
                : marquee
                  ? animationReady
                    ? ({
                        "--sponsors-marquee-shift": `${shift}px`,
                        animationName: "sponsors-marquee",
                        animationDuration: `${shift / MARQUEE_SPEED_PX_PER_SEC}s`,
                        animationTimingFunction: "linear",
                        animationIterationCount: "infinite",
                      } as React.CSSProperties)
                    : undefined
                  : { scrollbarWidth: "none" }
            }
          >
            {items.map((sponsor, i) => {
              const isClone = i >= sponsors.length;
              return (
                <li
                  key={i}
                  aria-hidden={isClone || undefined}
                  className={few ? "" : marquee ? "shrink-0" : "shrink-0 snap-start"}
                >
                  <SponsorTile sponsor={sponsor} sizes={s} inert={isClone} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SponsorTile({
  sponsor,
  sizes,
  inert = false,
}: {
  sponsor: Sponsor;
  sizes: (typeof SIZES)[SizeVariant];
  /** True for the duplicated marquee set — keeps clones out of the tab order. */
  inert?: boolean;
}) {
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
      tabIndex={inert ? -1 : undefined}
      className={`${tileClass} transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-8px_rgba(20,60,30,0.25)] active:opacity-85`}
    >
      {body}
    </a>
  ) : (
    <div className={tileClass}>{body}</div>
  );
}
