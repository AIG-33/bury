import { describe, expect, it } from "vitest";
import { expandRecurrence, isoWeekday, parseISODate } from "./expand";
import type { SlotForm } from "./schema";

const baseForm = (
  rec: SlotForm["recurrence"],
  overrides: Partial<SlotForm> = {},
): SlotForm => ({
  court_id: "00000000-0000-0000-0000-000000000000",
  start_time: "18:00",
  duration_minutes: 60,
  slot_type: "individual",
  max_participants: 1,
  price_pln: null,
  notes: null,
  recurrence: rec,
  ...overrides,
});

describe("expandRecurrence", () => {
  it("emits one occurrence for single", () => {
    const out = expandRecurrence(
      baseForm({ kind: "single", date: "2026-05-01" }),
    );
    expect(out).toEqual([
      { local_date: "2026-05-01", local_start_time: "18:00", duration_minutes: 60 },
    ]);
  });

  it("emits weekly occurrences for selected weekdays across N weeks", () => {
    // 2026-04-27 = Monday. Pick Mon (1) + Wed (3) for 3 weeks.
    const out = expandRecurrence(
      baseForm({
        kind: "weekly",
        start_date: "2026-04-27",
        weeks: 3,
        weekdays: [1, 3],
      }),
    );
    expect(out.map((o) => o.local_date)).toEqual([
      "2026-04-27", // Mon w1
      "2026-04-29", // Wed w1
      "2026-05-04", // Mon w2
      "2026-05-06", // Wed w2
      "2026-05-11", // Mon w3
      "2026-05-13", // Wed w3
    ]);
    expect(out.every((o) => o.duration_minutes === 60)).toBe(true);
  });

  it("skips dates before start_date in week 0 if start_date is mid-week", () => {
    // 2026-04-29 is Wednesday. Pick Mon + Wed.
    const out = expandRecurrence(
      baseForm({
        kind: "weekly",
        start_date: "2026-04-29",
        weeks: 2,
        weekdays: [1, 3],
      }),
    );
    // 14-day window starting Wed Apr 29: Wed Apr 29, Mon May 4, Wed May 6,
    // Mon May 11 — 4 occurrences total.
    expect(out.map((o) => o.local_date)).toEqual([
      "2026-04-29",
      "2026-05-04",
      "2026-05-06",
      "2026-05-11",
    ]);
  });

  it("emits nothing when weekly weekdays are empty (impossible via Zod, but pure-fn safe)", () => {
    const out = expandRecurrence(
      baseForm({
        kind: "weekly",
        start_date: "2026-05-01",
        weeks: 4,
        weekdays: [],
      }),
    );
    expect(out).toHaveLength(0);
  });
});

describe("isoWeekday", () => {
  it("treats Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday(parseISODate("2026-04-27"))).toBe(1); // Mon
    expect(isoWeekday(parseISODate("2026-05-03"))).toBe(7); // Sun
  });
});
