import { Link } from "@/i18n/routing";

/**
 * Player display name that links to the public profile /players/[id].
 *
 * Renders plain text when the id is missing (TBD slot, bye) or the player is
 * tombstoned (display name is null) — those must not navigate anywhere.
 * Works in both server and client components.
 */
export function PlayerNameLink({
  id,
  name,
  fallback = "—",
  className,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  /** Shown when the name is missing; never linked. */
  fallback?: string;
  className?: string;
}) {
  if (!id || !name) return <>{name ?? fallback}</>;
  return (
    <Link
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      href={`/players/${id}` as any}
      className={className ?? "transition-colors hover:text-grass-800 hover:underline"}
    >
      {name}
    </Link>
  );
}
