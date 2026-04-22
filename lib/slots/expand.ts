// =============================================================================
// Slot expansion — pure helpers for turning a SlotForm into concrete
// (starts_at, ends_at) pairs in UTC. Default timezone for the platform is
// Europe/Warsaw, but we keep this layer timezone-agnostic and accept the
// Europe/Warsaw → UTC conversion done by callers (or by Postgres).
//
// Why JS instead of RRULE?
//   – We support exactly two recurrence shapes for MVP (single + weekly).
//   – Avoids pulling in `rrule` dependency.
//   – Trivially unit-testable.
// =============================================================================

import type { SlotForm, IsoWeekday } from "./schema";

export type SlotOccurrence = {
  /** ISO date in YYYY-MM-DD format (local Europe/Warsaw date). */
  local_date: string;
  /** HH:MM (24h, local). */
  local_start_time: string;
  duration_minutes: number;
};

/**
 * Expand recurrence config into a flat list of occurrences.
 * Keeps everything in local-date / local-time space; the actual UTC conversion
 * happens in the SQL layer using `(timestamp ‖ ' Europe/Warsaw') AT TIME ZONE`.
 */
export function expandRecurrence(form: SlotForm): SlotOccurrence[] {
  const { recurrence, start_time, duration_minutes } = form;

  if (recurrence.kind === "single") {
    return [
      {
        local_date: recurrence.date,
        local_start_time: start_time,
        duration_minutes,
      },
    ];
  }

  // Custom multi-date list. Schema already deduped + sorted the input.
  if (recurrence.kind === "dates") {
    return recurrence.dates.map((d) => ({
      local_date: d,
      local_start_time: start_time,
      duration_minutes,
    }));
  }

  // Weekly: walk N weeks starting from start_date and emit one occurrence
  // per chosen weekday whose date is >= start_date.
  const out: SlotOccurrence[] = [];
  const startDate = parseISODate(recurrence.start_date);
  const weekdaySet = new Set<IsoWeekday>(recurrence.weekdays);

  for (let week = 0; week < recurrence.weeks; week++) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = addDays(startDate, week * 7 + dayOffset);
      if (week === 0 && d < startDate) continue;
      if (weekdaySet.has(isoWeekday(d))) {
        out.push({
          local_date: formatISODate(d),
          local_start_time: start_time,
          duration_minutes,
        });
      }
    }
  }

  return out;
}

// ─── Date helpers (UTC-safe, no timezone math) ────────────────────────────────

/** Parse `YYYY-MM-DD` into a UTC midnight Date. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function formatISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

/** ISO weekday: 1=Mon … 7=Sun. */
export function isoWeekday(d: Date): IsoWeekday {
  const js = d.getUTCDay(); // 0=Sun … 6=Sat
  return ((js === 0 ? 7 : js) as IsoWeekday);
}

/**
 * Build a UTC Date from local Europe/Warsaw wall-clock components.
 * Browsers that render slot cards do not need to resolve the actual UTC offset
 * (they get an ISO string from the server). This helper is provided for tests.
 */
export function localWarsawToUTC(date: string, time: string): Date {
  // Cheap approximation good enough for tests: parse as if components are UTC
  // and let the server do the real Europe/Warsaw conversion. This function is
  // NOT used in production code paths that hit the DB.
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0));
}
