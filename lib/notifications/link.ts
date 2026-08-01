/**
 * Where does a notification lead? New rows carry an explicit `link_url`
 * (locale-less in-app path, e.g. "/tournaments/<id>"); legacy rows derive a
 * fallback from `template` + `payload`. The mobile feed maps web paths onto
 * their /m twins where one exists.
 */

import { z } from "zod";

const PayloadSchema = z.record(z.string(), z.unknown());

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/** template + payload → web path, for rows created before link_url existed. */
function deriveFromTemplate(template: string, payload: Record<string, unknown>): string | null {
  switch (template) {
    case "tournament_registered":
    case "tournament_application_approved":
    case "tournament_application_rejected":
    case "tournament_starting_24h":
    case "tournament_match_scheduled": {
      const id = str(payload, "tournament_id");
      return id ? `/tournaments/${id}` : null;
    }
    case "tournament_application_submitted": {
      const id = str(payload, "tournament_id");
      return id ? `/me/tournaments/organized/${id}` : null;
    }
    case "match_proposal":
      return "/me/find/proposals";
    case "match_accepted":
    case "match_confirmed":
    case "match_disputed":
      return "/me/matches";
    case "booking_confirmed":
    case "booking_cancelled":
    case "booking_reminder_24h":
      return "/me/bookings";
    case "club_application_submitted": {
      const id = str(payload, "club_id");
      return id ? `/me/clubs/owned/${id}` : "/me/clubs";
    }
    case "club_application_approved": {
      const slug = str(payload, "club_slug");
      return slug ? `/clubs/${slug}` : "/me/clubs";
    }
    case "club_ownership_offered":
      return "/me/clubs";
    case "venue_comment_added": {
      const id = str(payload, "venue_id");
      return id ? `/venues/${id}` : null;
    }
    case "rating_changed":
    case "season_summary":
      return "/me/rating";
    default:
      return null;
  }
}

/** Web path → its /m twin, where the mobile app has one. */
export function toMobilePath(path: string): string {
  if (/^\/tournaments\/[^/]+$/.test(path)) return `/m${path}`;
  if (path === "/tournaments") return "/m/tournaments";
  if (/^\/clubs\/[^/]+$/.test(path)) return `/m${path}`;
  if (path === "/me/matches") return "/m/matches";
  if (path === "/me/rating") return "/m/rating";
  return path;
}

/**
 * Resolve the in-app path a notification row links to (locale-less — pass it
 * to the next-intl <Link>). Returns null when there is nothing to link to.
 */
export function notificationHref(args: {
  template: string;
  payload: unknown;
  linkUrl?: string | null;
  mobile?: boolean;
}): string | null {
  let path = args.linkUrl && args.linkUrl.startsWith("/") ? args.linkUrl : null;
  if (!path) {
    const parsed = PayloadSchema.safeParse(args.payload);
    path = deriveFromTemplate(args.template, parsed.success ? parsed.data : {});
  }
  if (!path) return null;
  return args.mobile ? toMobilePath(path) : path;
}
