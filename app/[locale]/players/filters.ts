// Pure module — NO "use server". Holds constants and types reused by both
// the server action (`./actions.ts`) and the page (`./page.tsx`). Keeping
// them out of the action file is mandatory: Next.js 16 forbids non-async
// exports from a `"use server"` module ("found object" build error).

/** UI buckets we expose to guests instead of asking for raw Elo numbers. */
export const LEVEL_BUCKETS = [
  "any",
  "beginner", // ≤ 950
  "intermediate", // 951 – 1300
  "advanced", // 1301 – 1700
  "expert", // ≥ 1701
] as const;
export type LevelBucket = (typeof LEVEL_BUCKETS)[number];

export const LEVEL_RANGES: Record<LevelBucket, { min: number; max: number }> = {
  any: { min: 0, max: 4000 },
  beginner: { min: 0, max: 950 },
  intermediate: { min: 951, max: 1300 },
  advanced: { min: 1301, max: 1700 },
  expert: { min: 1701, max: 4000 },
};
