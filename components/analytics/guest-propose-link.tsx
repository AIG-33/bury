"use client";

import { LogIn } from "lucide-react";
import { Link } from "@/i18n/routing";
import { track } from "@/lib/analytics/posthog-client";

type Surface = "players_list" | "player_profile";

/**
 * Anonymous "Propose match" CTA.
 *
 * Wraps the `/login?next=/me/find?focus=<id>` deep-link with a click
 * handler that fires PostHog event `players.guest_propose_clicked`.
 * The track call runs in the same tick as the navigation, so the event
 * is queued even if the new page renders before PostHog flushes.
 */
export function GuestProposeLink({
  playerId,
  label,
  surface,
  className,
}: {
  playerId: string;
  label: string;
  surface: Surface;
  className: string;
}) {
  return (
    <Link
      href={{ pathname: "/login", query: { next: `/me/find?focus=${playerId}` } }}
      onClick={() => {
        track("players.guest_propose_clicked", {
          player_id: playerId,
          surface,
        });
      }}
      className={className}
    >
      <LogIn className="h-4 w-4" />
      {label}
    </Link>
  );
}
