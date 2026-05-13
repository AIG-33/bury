import { Link } from "@/i18n/routing";
import { ClubLogo } from "./club-logo";

type PrimaryClubBadgeProps = {
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Visual variant. `chip` is a single inline pill for headers; `row` is a list-row layout for cards. */
  variant?: "chip" | "row";
  /** Optional ARIA label, e.g. "Primary club:" */
  prefix?: string;
};

/**
 * Compact "Primary club: <name>" badge surfaced next to player and coach
 * names. The badge is a Link to the public club page so a single click
 * jumps from a player card to the club roster.
 *
 * Renders as `null` if there is no primary club (caller decides whether
 * to show a placeholder or nothing at all).
 */
export function PrimaryClubBadge({
  slug,
  name,
  logoUrl,
  variant = "chip",
  prefix,
}: PrimaryClubBadgeProps) {
  if (variant === "row") {
    return (
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/clubs/${slug}` as any}
        className="group inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-2 py-1.5 transition hover:border-grass-300 hover:bg-grass-50"
      >
        <ClubLogo url={logoUrl} name={name} size="sm" />
        <span className="min-w-0">
          {prefix && (
            <span className="block text-[10px] uppercase tracking-wider text-ink-500">
              {prefix}
            </span>
          )}
          <span className="block truncate font-display text-sm font-semibold text-ink-900 group-hover:text-grass-800">
            {name}
          </span>
        </span>
      </Link>
    );
  }
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={`/clubs/${slug}` as any}
      title={prefix ? `${prefix} ${name}` : name}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-100 bg-white pl-1 pr-2.5 py-0.5 text-xs font-medium text-ink-700 transition hover:border-grass-300 hover:bg-grass-50 hover:text-grass-800"
    >
      <ClubLogo url={logoUrl} name={name} size="sm" />
      <span className="truncate">{name}</span>
    </Link>
  );
}
