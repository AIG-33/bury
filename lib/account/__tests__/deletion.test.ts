import { describe, expect, it } from "vitest";
import {
  anonymizedProfileUpdate,
  decideAccountDeletion,
  isValidConfirmationWord,
  type AccountUsage,
} from "../deletion";

function usage(overrides: Partial<AccountUsage> = {}): AccountUsage {
  return {
    ownedClubs: [],
    ownedTournaments: [],
    matchesCount: 0,
    keptParticipationsCount: 0,
    ...overrides,
  };
}

describe("decideAccountDeletion — owner-block rule", () => {
  it("blocks when the user owns a club", () => {
    const d = decideAccountDeletion(usage({ ownedClubs: [{ id: "c1", name: "ТК Минск" }] }));
    expect(d).toEqual({
      kind: "blocked",
      clubs: [{ id: "c1", name: "ТК Минск" }],
      tournaments: [],
    });
  });

  it("blocks when the user owns a tournament in registration", () => {
    const d = decideAccountDeletion(
      usage({
        ownedTournaments: [{ id: "t1", name: "Кубок", status: "registration" }],
      }),
    );
    expect(d.kind).toBe("blocked");
    if (d.kind === "blocked") {
      expect(d.tournaments.map((t) => t.id)).toEqual(["t1"]);
    }
  });

  it("blocks when the user owns a tournament in progress", () => {
    const d = decideAccountDeletion(
      usage({
        ownedTournaments: [{ id: "t1", name: "Кубок", status: "in_progress" }],
      }),
    );
    expect(d.kind).toBe("blocked");
  });

  it("does not block for draft / finished / cancelled tournaments", () => {
    const d = decideAccountDeletion(
      usage({
        ownedTournaments: [
          { id: "t1", name: "Черновик", status: "draft" },
          { id: "t2", name: "Прошедший", status: "finished" },
          { id: "t3", name: "Отменённый", status: "cancelled" },
        ],
      }),
    );
    expect(d.kind).toBe("proceed");
  });
});

describe("decideAccountDeletion — purge vs anonymize", () => {
  it("purges a user with no shared history", () => {
    expect(decideAccountDeletion(usage())).toEqual({
      kind: "proceed",
      mode: "purge",
      deletableTournamentIds: [],
    });
  });

  it("anonymizes when the user has matches", () => {
    const d = decideAccountDeletion(usage({ matchesCount: 3 }));
    expect(d).toMatchObject({ kind: "proceed", mode: "anonymize" });
  });

  it("anonymizes when the user stays in a finished tournament bracket", () => {
    const d = decideAccountDeletion(usage({ keptParticipationsCount: 1 }));
    expect(d).toMatchObject({ kind: "proceed", mode: "anonymize" });
  });

  it("anonymizes when the user owns a finished tournament", () => {
    const d = decideAccountDeletion(
      usage({
        ownedTournaments: [{ id: "t2", name: "Прошедший", status: "finished" }],
      }),
    );
    expect(d).toMatchObject({ kind: "proceed", mode: "anonymize" });
  });

  it("collects draft tournaments for deletion", () => {
    const d = decideAccountDeletion(
      usage({
        ownedTournaments: [
          { id: "t1", name: "Черновик", status: "draft" },
          { id: "t2", name: "Прошедший", status: "finished" },
        ],
      }),
    );
    expect(d).toEqual({
      kind: "proceed",
      mode: "anonymize",
      deletableTournamentIds: ["t1"],
    });
  });
});

describe("anonymizedProfileUpdate — tombstone payload", () => {
  const payload = anonymizedProfileUpdate();

  it("replaces the name with the placeholder", () => {
    expect(payload.first_name).toBe("Удалённый");
    expect(payload.last_name).toBe("игрок");
    expect(payload.email_local).toBeNull();
  });

  it("strips every contact / PII column", () => {
    for (const key of [
      "avatar_url",
      "date_of_birth",
      "gender",
      "phone",
      "whatsapp",
      "telegram_username",
      "city",
      "district_id",
      "lat",
      "lng",
      "health_notes",
      "emergency_contact",
      "coach_bio",
      "coach_slug",
    ]) {
      expect(payload[key], key).toBeNull();
    }
    expect(payload.social_links).toEqual({});
    expect(payload.availability).toEqual({});
  });

  it("revokes roles and hides the profile everywhere", () => {
    expect(payload.is_admin).toBe(false);
    expect(payload.is_coach).toBe(false);
    expect(payload.coach_show_on_map).toBe(false);
    expect(payload.visible_in_find_player).toBe(false);
    expect(payload.visible_in_leaderboard).toBe(false);
    expect(payload.notification_email).toBe(false);
    expect(payload.notification_telegram).toBe(false);
    expect(payload.notification_whatsapp).toBe(false);
  });

  it("keeps Elo columns untouched (opponents' history consistency)", () => {
    expect(payload).not.toHaveProperty("current_elo");
    expect(payload).not.toHaveProperty("elo_status");
    expect(payload).not.toHaveProperty("rated_matches_count");
  });
});

describe("isValidConfirmationWord", () => {
  it("accepts the ru and en confirmation words, case/space-insensitively", () => {
    expect(isValidConfirmationWord("УДАЛИТЬ")).toBe(true);
    expect(isValidConfirmationWord(" удалить ")).toBe(true);
    expect(isValidConfirmationWord("delete")).toBe(true);
    expect(isValidConfirmationWord("DELETE")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidConfirmationWord("")).toBe(false);
    expect(isValidConfirmationWord("удали")).toBe(false);
    expect(isValidConfirmationWord("DEL")).toBe(false);
  });
});
