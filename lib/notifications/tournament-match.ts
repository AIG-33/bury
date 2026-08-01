/**
 * «У тебя новый матч в турнире X против Y» — notifications for freshly paired
 * tournament matches.
 *
 * Fired from every organizer action that creates or completes a match pair:
 * group generation, bracket generation, playoff seeding, winner propagation,
 * roster additions and manual slot edits. Both players of a pair (all four in
 * doubles) get an outbox row; the row doubles as the in-app feed item on
 * /m/notifications and — when the recipient opted into e-mail — is delivered
 * by the outbox cron.
 *
 * Dedup: one notification per (recipient, opponent pair, stage) within a
 * tournament. Re-generating groups or re-seeding the playoff re-creates the
 * same pairs with new match ids — those recipients are NOT notified again.
 * A rematch in a different stage (group → playoff final) IS notified.
 */

import { z } from "zod";
import { composePairName } from "@/lib/tournaments/pairs";
import type { Locale } from "./templates";

export const TOURNAMENT_MATCH_TEMPLATE = "tournament_match_scheduled" as const;

/** Zod schema of the outbox payload for tournament_match_scheduled rows. */
export const TournamentMatchPayloadSchema = z.object({
  tournament_id: z.string().uuid(),
  tournament_name: z.string(),
  match_id: z.string().uuid(),
  /** Captain of the opposing side (pair captain in doubles). */
  opponent_id: z.string().uuid(),
  opponent_name: z.string(),
  stage: z.string().nullable(),
});
export type TournamentMatchPayload = z.infer<typeof TournamentMatchPayloadSchema>;

export type NotifiableMatch = {
  id: string;
  p1_id: string | null;
  p2_id: string | null;
  p1_partner_id?: string | null;
  p2_partner_id?: string | null;
  is_doubles: boolean;
  stage: string | null;
};

export type RecipientProfile = {
  id: string;
  display_name: string | null;
  locale: Locale;
  notification_email: boolean;
};

export type OutboxMatchRow = {
  recipient_id: string;
  channel: "email";
  template: typeof TOURNAMENT_MATCH_TEMPLATE;
  locale: Locale;
  payload: TournamentMatchPayload;
  /** pending → the cron delivers an e-mail; cancelled → in-app feed only. */
  status: "pending" | "cancelled";
  link_url: string;
};

/** One notification per (recipient, opponent pair, stage) in a tournament. */
export function tournamentMatchDedupKey(
  recipientId: string,
  opponentId: string,
  stage: string | null,
): string {
  return `${recipientId}|${opponentId}|${stage ?? "main"}`;
}

function fallbackOpponentName(locale: Locale): string {
  return locale === "ru" ? "соперник" : "opponent";
}

/**
 * Pure part of the flow: matches + profiles + already-sent keys → outbox rows.
 * Matches with an empty side (byes, TBD playoff slots) are skipped.
 */
export function buildTournamentMatchNotifications(args: {
  tournamentId: string;
  tournamentName: string;
  matches: NotifiableMatch[];
  profiles: Map<string, RecipientProfile>;
  existingKeys: Set<string>;
}): OutboxMatchRow[] {
  const { tournamentId, tournamentName, matches, profiles, existingKeys } = args;
  const rows: OutboxMatchRow[] = [];
  const batchKeys = new Set<string>();

  const nameOf = (playerId: string | null | undefined): string | null => {
    if (!playerId) return null;
    return profiles.get(playerId)?.display_name?.trim() || null;
  };

  for (const m of matches) {
    if (!m.p1_id || !m.p2_id) continue;

    const sides: Array<{
      recipients: string[];
      opponentCaptain: string;
      opponentPartner: string | null;
    }> = [
      {
        recipients: [m.p1_id, ...(m.is_doubles && m.p1_partner_id ? [m.p1_partner_id] : [])],
        opponentCaptain: m.p2_id,
        opponentPartner: m.is_doubles ? (m.p2_partner_id ?? null) : null,
      },
      {
        recipients: [m.p2_id, ...(m.is_doubles && m.p2_partner_id ? [m.p2_partner_id] : [])],
        opponentCaptain: m.p1_id,
        opponentPartner: m.is_doubles ? (m.p1_partner_id ?? null) : null,
      },
    ];

    for (const side of sides) {
      for (const recipientId of side.recipients) {
        const profile = profiles.get(recipientId);
        if (!profile) continue;

        const key = tournamentMatchDedupKey(recipientId, side.opponentCaptain, m.stage);
        if (existingKeys.has(key) || batchKeys.has(key)) continue;
        batchKeys.add(key);

        const captainName = nameOf(side.opponentCaptain);
        const opponentName = m.is_doubles
          ? composePairName(captainName, nameOf(side.opponentPartner))
          : (captainName ?? fallbackOpponentName(profile.locale));

        rows.push({
          recipient_id: recipientId,
          channel: "email",
          template: TOURNAMENT_MATCH_TEMPLATE,
          locale: profile.locale,
          payload: {
            tournament_id: tournamentId,
            tournament_name: tournamentName,
            match_id: m.id,
            opponent_id: side.opponentCaptain,
            opponent_name: opponentName,
            stage: m.stage,
          },
          status: profile.notification_email ? "pending" : "cancelled",
          link_url: `/tournaments/${tournamentId}`,
        });
      }
    }
  }
  return rows;
}

// Loose Supabase shape — accepts the service client (RLS-free reads/writes).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

/**
 * Best-effort side effect: never throws, never blocks the primary action.
 * MUST be called with the service-role client — it reads other players'
 * profiles and inserts outbox rows for them.
 */
export async function notifyNewTournamentMatches(
  service: AnySupabase,
  tournamentId: string,
  matches: NotifiableMatch[],
): Promise<{ enqueued: number }> {
  try {
    const paired = matches.filter((m) => m.p1_id && m.p2_id);
    if (paired.length === 0) return { enqueued: 0 };

    const playerIds = Array.from(
      new Set(paired.flatMap((m) => [m.p1_id, m.p2_id, m.p1_partner_id, m.p2_partner_id])),
    ).filter((x): x is string => !!x);

    const { data: t } = (await service
      .from("tournaments")
      .select("name")
      .eq("id", tournamentId)
      .maybeSingle()) as { data: { name: string } | null };
    if (!t) return { enqueued: 0 };

    const { data: profileRows } = (await service
      .from("profiles")
      .select("id, display_name, locale, notification_email")
      .in("id", playerIds)) as {
      data: Array<{
        id: string;
        display_name: string | null;
        locale: Locale;
        notification_email: boolean;
      }> | null;
    };
    const profiles = new Map<string, RecipientProfile>((profileRows ?? []).map((p) => [p.id, p]));

    // Everything already notified in this tournament, keyed for dedup.
    const { data: existing } = (await service
      .from("notifications_outbox")
      .select("recipient_id, payload")
      .eq("template", TOURNAMENT_MATCH_TEMPLATE)
      .eq("payload->>tournament_id", tournamentId)
      .in("recipient_id", playerIds)) as {
      data: Array<{ recipient_id: string; payload: unknown }> | null;
    };
    const existingKeys = new Set<string>();
    for (const row of existing ?? []) {
      const parsed = TournamentMatchPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      existingKeys.add(
        tournamentMatchDedupKey(row.recipient_id, parsed.data.opponent_id, parsed.data.stage),
      );
    }

    const rows = buildTournamentMatchNotifications({
      tournamentId,
      tournamentName: t.name,
      matches: paired,
      profiles,
      existingKeys,
    });
    if (rows.length === 0) return { enqueued: 0 };

    const { error } = await service.from("notifications_outbox").insert(rows as never);
    if (error) {
      console.warn("[notifications] tournament match enqueue failed:", error.message);
      return { enqueued: 0 };
    }
    return { enqueued: rows.length };
  } catch (e) {
    console.warn("[notifications] tournament match enqueue crashed:", e);
    return { enqueued: 0 };
  }
}
