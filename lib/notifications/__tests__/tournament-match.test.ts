import { describe, expect, it } from "vitest";
import {
  buildTournamentMatchNotifications,
  tournamentMatchDedupKey,
  type NotifiableMatch,
  type RecipientProfile,
} from "../tournament-match";
import { renderTemplate } from "../templates";

const T_ID = "11111111-1111-4111-8111-111111111111";
const M_ID = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function profiles(
  entries: Array<[string, Partial<RecipientProfile>]>,
): Map<string, RecipientProfile> {
  return new Map(
    entries.map(([id, p]) => [
      id,
      {
        id,
        display_name: p.display_name ?? null,
        locale: p.locale ?? "ru",
        notification_email: p.notification_email ?? true,
      },
    ]),
  );
}

const singlesMatch: NotifiableMatch = {
  id: M_ID,
  p1_id: A,
  p2_id: B,
  is_doubles: false,
  stage: "group",
};

describe("buildTournamentMatchNotifications", () => {
  it("notifies both players of a singles pair with the opponent's name", () => {
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      matches: [singlesMatch],
      profiles: profiles([
        [A, { display_name: "Alice", locale: "en" }],
        [B, { display_name: "Boris", locale: "ru" }],
      ]),
      existingKeys: new Set(),
    });
    expect(rows).toHaveLength(2);
    const forA = rows.find((r) => r.recipient_id === A)!;
    expect(forA.payload.opponent_name).toBe("Boris");
    expect(forA.payload.opponent_id).toBe(B);
    expect(forA.locale).toBe("en");
    expect(forA.link_url).toBe(`/tournaments/${T_ID}`);
    const forB = rows.find((r) => r.recipient_id === B)!;
    expect(forB.payload.opponent_name).toBe("Alice");
  });

  it("skips matches with an empty side (byes / TBD)", () => {
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      matches: [{ ...singlesMatch, p2_id: null }],
      profiles: profiles([[A, {}]]),
      existingKeys: new Set(),
    });
    expect(rows).toHaveLength(0);
  });

  it("respects notification_email → pending vs cancelled (in-app only)", () => {
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      matches: [singlesMatch],
      profiles: profiles([
        [A, { notification_email: true }],
        [B, { notification_email: false }],
      ]),
      existingKeys: new Set(),
    });
    expect(rows.find((r) => r.recipient_id === A)!.status).toBe("pending");
    expect(rows.find((r) => r.recipient_id === B)!.status).toBe("cancelled");
  });

  it("dedups against existing keys and inside the batch", () => {
    const existing = new Set([tournamentMatchDedupKey(A, B, "group")]);
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      // Same pair twice in one batch (can't normally happen, but guard).
      matches: [singlesMatch, { ...singlesMatch, id: C }],
      profiles: profiles([
        [A, {}],
        [B, {}],
      ]),
      existingKeys: existing,
    });
    // A already notified about B in the group stage; B gets exactly one row.
    expect(rows.filter((r) => r.recipient_id === A)).toHaveLength(0);
    expect(rows.filter((r) => r.recipient_id === B)).toHaveLength(1);
  });

  it("same opponents in a different stage are notified again", () => {
    const existing = new Set([
      tournamentMatchDedupKey(A, B, "group"),
      tournamentMatchDedupKey(B, A, "group"),
    ]);
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      matches: [{ ...singlesMatch, stage: "playoff" }],
      profiles: profiles([
        [A, {}],
        [B, {}],
      ]),
      existingKeys: existing,
    });
    expect(rows).toHaveLength(2);
  });

  it("doubles: all four players notified, opponent is the pair line", () => {
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Doubles Cup",
      matches: [
        {
          id: M_ID,
          p1_id: A,
          p2_id: B,
          p1_partner_id: C,
          p2_partner_id: D,
          is_doubles: true,
          stage: "group",
        },
      ],
      profiles: profiles([
        [A, { display_name: "Alice" }],
        [B, { display_name: "Boris" }],
        [C, { display_name: "Clara" }],
        [D, { display_name: "Dima" }],
      ]),
      existingKeys: new Set(),
    });
    expect(rows).toHaveLength(4);
    const forC = rows.find((r) => r.recipient_id === C)!;
    expect(forC.payload.opponent_name).toBe("Boris / Dima");
    expect(forC.payload.opponent_id).toBe(B);
  });

  it("falls back to a localized generic opponent name", () => {
    const rows = buildTournamentMatchNotifications({
      tournamentId: T_ID,
      tournamentName: "Men Open",
      matches: [singlesMatch],
      profiles: profiles([
        [A, { locale: "ru" }],
        [B, { locale: "en" }],
      ]),
      existingKeys: new Set(),
    });
    expect(rows.find((r) => r.recipient_id === A)!.payload.opponent_name).toBe("соперник");
    expect(rows.find((r) => r.recipient_id === B)!.payload.opponent_name).toBe("opponent");
  });
});

describe("tournament_match_scheduled email template", () => {
  it("renders RU subject/body with tournament and opponent", () => {
    const r = renderTemplate("tournament_match_scheduled", "ru", {
      tournament_id: T_ID,
      tournament_name: "Men Open",
      opponent_name: "Boris",
    });
    expect(r.subject).toContain("Men Open");
    expect(r.html).toContain("Boris");
    expect(r.html).toContain(`/tournaments/${T_ID}`);
  });

  it("renders EN subject/body", () => {
    const r = renderTemplate("tournament_match_scheduled", "en", {
      tournament_id: T_ID,
      tournament_name: "Men Open",
      opponent_name: "Boris",
    });
    expect(r.subject).toContain("New match");
  });
});
