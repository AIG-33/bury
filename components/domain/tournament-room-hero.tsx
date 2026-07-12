import type { ReactNode } from "react";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import type { TournamentBranding } from "@/lib/validators/tournament-branding";

// =============================================================================
// Full-width branded hero for the public tournament room page.
//
// Renders ONLY when the organizer has customised branding (banner / logo /
// colors / tagline / title). Otherwise `shouldRenderHero` is false and the
// page falls back to its default <PageHeader> — graceful degradation.
//
// Accessibility: text over the banner sits on a dark gradient scrim (opacity
// clamped in buildRoomTheme) and is always white; text over a flat color uses
// the auto-picked contrast color. All colors/urls are pre-sanitised.
// =============================================================================

export function shouldRenderHero(branding: TournamentBranding): boolean {
  const theme = buildRoomTheme(branding);
  return (
    theme.themed ||
    branding.tagline != null ||
    branding.title_override != null ||
    branding.sponsors.length > 0
  );
}

export function TournamentRoomHero({
  branding,
  fallbackTitle,
  sponsorsLabel,
  help,
}: {
  branding: TournamentBranding;
  fallbackTitle: string;
  sponsorsLabel: string;
  help?: ReactNode;
}) {
  const theme = buildRoomTheme(branding);
  const title = branding.title_override || fallbackTitle;
  const overBanner = theme.bannerImageStyle != null;
  const heroTextColor = overBanner ? "#ffffff" : theme.textColor;

  return (
    <div
      className={theme.fontClass}
      style={{ ...theme.backgroundStyle, color: heroTextColor }}
    >
      {/* Accent top bar */}
      {theme.accentColor && (
        <div aria-hidden style={{ height: 4, backgroundColor: theme.accentColor }} />
      )}

      <div className="relative">
        {/* Banner image + scrim */}
        {overBanner && (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: theme.bannerImageStyle! }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,${Math.max(
                  0,
                  theme.scrimOpacity - 0.2,
                )}) 60%, rgba(0,0,0,${Math.max(0, theme.scrimOpacity - 0.35)}) 100%)`,
              }}
            />
          </>
        )}

        <div
          className="page-shell relative flex flex-wrap items-center gap-4"
          style={{ minHeight: overBanner ? 200 : undefined }}
        >
          {theme.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl border-2 object-contain sm:h-20 sm:w-20"
              style={{
                borderColor: theme.accentColor ?? "rgba(255,255,255,0.6)",
                background: "rgba(255,255,255,0.92)",
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="font-display text-2xl font-bold leading-tight sm:text-3xl"
              style={{ color: heroTextColor }}
            >
              {title}
            </h1>
            {branding.tagline && (
              <p
                className="mt-1 text-sm sm:text-base"
                style={{ color: overBanner ? "rgba(255,255,255,0.85)" : theme.mutedTextColor }}
              >
                {branding.tagline}
              </p>
            )}
          </div>
          {help && <div className="relative z-10 shrink-0">{help}</div>}
        </div>

        {/* Sponsor strip */}
        {branding.sponsors.length > 0 && (
          <div className="page-shell relative pb-4">
            <p
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: overBanner ? "rgba(255,255,255,0.8)" : theme.mutedTextColor }}
            >
              {sponsorsLabel}
            </p>
            <ul className="flex flex-wrap items-center gap-3">
              {branding.sponsors.map((s, i) => (
                <li key={i}>
                  <SponsorBadge sponsor={s} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SponsorBadge({
  sponsor,
}: {
  sponsor: TournamentBranding["sponsors"][number];
}) {
  const inner = sponsor.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sponsor.logo_url}
      alt={sponsor.name}
      title={sponsor.name}
      className="h-8 w-auto max-w-[120px] rounded bg-white/90 object-contain px-2 py-1"
    />
  ) : (
    <span className="inline-flex items-center rounded bg-white/90 px-2 py-1 text-xs font-medium text-ink-800">
      {sponsor.name}
    </span>
  );
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noreferrer noopener nofollow" style={{ display: "inline-flex" }}>
      {inner}
    </a>
  ) : (
    inner
  );
}
