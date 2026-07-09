import { describe, it, expect } from "vitest";
import {
  TournamentTemplatePayloadSchema,
  SaveTemplateSchema,
  templatePayloadFromForm,
  formFromTemplatePayload,
  templatePayloadFromRow,
} from "./template-schema";
import { TournamentFormSchema, type TournamentForm } from "./schema";

const FULL_FORM: TournamentForm = TournamentFormSchema.parse({
  name: "Летняя лига — этап 3",
  description: "Ежемесячный этап",
  format: "round_robin",
  surface: "hard",
  starts_on: "2026-07-15",
  start_time: "19:00",
  ends_on: "2026-07-15",
  registration_deadline: "2026-07-14",
  max_participants: 16,
  entry_fee_byn: 30,
  privacy: "public",
  club_id: "3e9a2c9e-0000-4000-8000-000000000001",
  draw_method: "rating",
  prizes_description: "Мяч Wilson",
  match_rules: {
    kind: "pro_set",
    target_games: 8,
    no_ad: true,
  },
  venue_ids: ["3e9a2c9e-0000-4000-8000-000000000002"],
  third_place_match: false,
});

describe("templatePayloadFromForm", () => {
  it("strips run-specific fields (name, dates, deadline, club binding)", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("starts_on");
    expect(payload).not.toHaveProperty("ends_on");
    expect(payload).not.toHaveProperty("registration_deadline");
    expect(payload).not.toHaveProperty("club_id");
  });

  it("keeps every reusable setting", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    expect(payload.format).toBe("round_robin");
    expect(payload.surface).toBe("hard");
    expect(payload.start_time).toBe("19:00");
    expect(payload.max_participants).toBe(16);
    expect(payload.entry_fee_byn).toBe(30);
    expect(payload.privacy).toBe("public");
    expect(payload.draw_method).toBe("rating");
    expect(payload.prizes_description).toBe("Мяч Wilson");
    expect(payload.match_rules).toEqual({ kind: "pro_set", target_games: 8, no_ad: true });
    expect(payload.venue_ids).toEqual(["3e9a2c9e-0000-4000-8000-000000000002"]);
  });

  it("round-trips through the payload schema", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    const parsed = TournamentTemplatePayloadSchema.parse(payload);
    expect(parsed).toEqual(payload);
  });
});

describe("formFromTemplatePayload", () => {
  it("expands into a valid create form with fresh dates", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    const form = formFromTemplatePayload({
      templateName: "Этап лиги (понедельник)",
      payload,
      clubId: "3e9a2c9e-0000-4000-8000-000000000001",
      startsOn: "2026-08-01",
    });
    const parsed = TournamentFormSchema.parse(form);
    expect(parsed.name).toBe("Этап лиги (понедельник)");
    expect(parsed.starts_on).toBe("2026-08-01");
    expect(parsed.ends_on).toBeNull();
    expect(parsed.registration_deadline).toBeNull();
    expect(parsed.club_id).toBe("3e9a2c9e-0000-4000-8000-000000000001");
    expect(parsed.match_rules).toEqual(payload.match_rules);
  });

  it("defaults starts_on to today when not provided", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    const form = formFromTemplatePayload({
      templateName: "X",
      payload,
      clubId: null,
    });
    expect(form.starts_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.club_id).toBeNull();
  });
});

describe("templatePayloadFromRow", () => {
  it("parses a valid stored payload", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    const roundTripped = templatePayloadFromRow(JSON.parse(JSON.stringify(payload)));
    expect(roundTripped).toEqual(payload);
  });

  it("returns null for a payload that no longer matches the schema", () => {
    expect(templatePayloadFromRow({ format: "quidditch" })).toBeNull();
    expect(templatePayloadFromRow(null)).toBeNull();
    expect(templatePayloadFromRow("garbage")).toBeNull();
  });
});

describe("SaveTemplateSchema", () => {
  it("accepts a named payload with optional club binding", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    const ok = SaveTemplateSchema.safeParse({
      name: "Мой шаблон",
      club_id: "",
      payload,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.club_id).toBeNull();
  });

  it("rejects a too-short name", () => {
    const payload = templatePayloadFromForm(FULL_FORM);
    expect(SaveTemplateSchema.safeParse({ name: "A", payload }).success).toBe(false);
  });
});
