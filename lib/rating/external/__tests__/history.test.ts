import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTimeline, type ExternalEloPoint } from "../history";

// ---------------------------------------------------------------------------
// buildTimeline — pure helper that aggregates rows into singles+doubles
// series, computes 30d delta, best/worst, refresh count.
// ---------------------------------------------------------------------------

const baseRow = (over: Partial<ExternalEloPoint>): ExternalEloPoint => ({
  id: crypto.randomUUID(),
  created_at: new Date().toISOString(),
  old_elo: 1500,
  new_elo: 1500,
  delta: 0,
  discipline: "singles",
  display_tier_old: "Legger",
  display_tier_new: "Legger",
  is_calibrating: false,
  reason: "manual_refresh",
  ...over,
});

const baseCurrent = {
  source: "liga_tennisa" as const,
  external_id: "12345",
  external_url: "https://ligatennisa.com/players/12345",
  external_elo: 1530,
  external_elo_doubles: 1480,
  display_tier: "Legger",
  is_calibrating_singles: false,
  is_calibrating_doubles: false,
  last_refreshed_at: new Date().toISOString(),
  last_refresh_error: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildTimeline", () => {
  it("returns zeros + empty arrays when there are no points", () => {
    const t = buildTimeline(baseCurrent, []);
    expect(t.singles).toEqual([]);
    expect(t.doubles).toEqual([]);
    expect(t.delta_30d).toBe(0);
    expect(t.best_elo).toBe(baseCurrent.external_elo); // falls back to current snapshot
    expect(t.worst_elo).toBe(baseCurrent.external_elo);
    expect(t.refreshed_count).toBe(0);
  });

  it("splits singles vs doubles into independent series", () => {
    // The real DB query returns rows newest-first; buildTimeline reverses
    // them to oldest-first so the chart can render left → right by time.
    const rows: ExternalEloPoint[] = [
      baseRow({ created_at: "2026-05-13T00:00:00Z", new_elo: 1480, discipline: "doubles", old_elo: 1450, delta: 30 }),
      baseRow({ created_at: "2026-05-12T00:00:00Z", new_elo: 1525, discipline: "singles", old_elo: 1500, delta: 25 }),
      baseRow({ created_at: "2026-05-10T00:00:00Z", new_elo: 1500, discipline: "singles", reason: "initial_import", old_elo: null, delta: 0 }),
      baseRow({ created_at: "2026-05-10T00:00:00Z", new_elo: 1450, discipline: "doubles", reason: "initial_import", old_elo: null, delta: 0 }),
    ];

    const t = buildTimeline(baseCurrent, rows);
    expect(t.singles).toHaveLength(2);
    expect(t.doubles).toHaveLength(2);
    expect(t.singles.map((s) => s.new_elo)).toEqual([1500, 1525]); // ascending by created_at
    expect(t.doubles.map((s) => s.new_elo)).toEqual([1450, 1480]);
  });

  it("computes 30d delta from singles only (doubles is its own series)", () => {
    const rows: ExternalEloPoint[] = [
      baseRow({ created_at: "2026-04-01T00:00:00Z", new_elo: 1400, delta: -100, discipline: "singles" }), // outside 30d window
      baseRow({ created_at: "2026-05-01T00:00:00Z", new_elo: 1500, delta: 50, discipline: "singles" }),
      baseRow({ created_at: "2026-05-12T00:00:00Z", new_elo: 1530, delta: 30, discipline: "singles" }),
      baseRow({ created_at: "2026-05-12T00:00:00Z", new_elo: 1480, delta: 80, discipline: "doubles" }), // doubles ignored in delta_30d
    ];

    const t = buildTimeline(baseCurrent, rows);
    expect(t.delta_30d).toBe(80); // 50 + 30 (April outside window)
  });

  it("counts only manual_refresh rows in refreshed_count", () => {
    const rows: ExternalEloPoint[] = [
      baseRow({ reason: "initial_import", discipline: "singles" }),
      baseRow({ reason: "initial_import", discipline: "doubles" }),
      baseRow({ reason: "manual_refresh", discipline: "singles" }),
      baseRow({ reason: "manual_refresh", discipline: "doubles" }),
      baseRow({ reason: "manual_refresh", discipline: "singles" }),
      baseRow({ reason: "admin_set", discipline: "singles" }),
    ];

    const t = buildTimeline(baseCurrent, rows);
    expect(t.refreshed_count).toBe(3);
  });

  it("returns null shape only via the IO wrapper, not buildTimeline", () => {
    // buildTimeline always returns a shape; null is the outer wrapper's
    // job (when there's no external_ratings row at all).
    const t = buildTimeline(null, []);
    expect(t.current).toBeNull();
    expect(t.best_elo).toBe(0);
    expect(t.worst_elo).toBe(0);
  });

  it("computes best/worst from singles series, not doubles", () => {
    const rows: ExternalEloPoint[] = [
      baseRow({ new_elo: 1500, discipline: "singles" }),
      baseRow({ new_elo: 1600, discipline: "singles" }),
      baseRow({ new_elo: 1450, discipline: "singles" }),
      baseRow({ new_elo: 9999, discipline: "doubles" }), // doubles must NOT skew singles best
    ];

    const t = buildTimeline(baseCurrent, rows);
    expect(t.best_elo).toBe(1600);
    expect(t.worst_elo).toBe(1450);
  });
});
