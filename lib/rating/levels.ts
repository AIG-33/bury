// =============================================================================
// Elo level bands — friendlier label that sits next to a raw Elo number.
//
// We expose 5 bands: beginner / improver / confident / strong / elite. Bands
// are right-open intervals [min, max), so a player with exactly 1100 is in
// "confident", not "improver".
//
// Bands are intentionally coarse — fine-grained matchmaking is still done
// with the raw Elo radius slider on /me/find. The point of these labels is to
// give visitors a one-glance sense of "who is who" instead of decoding 1247.
// =============================================================================

export type LevelBandId = "beginner" | "improver" | "confident" | "strong" | "elite";

export type LevelBand = {
  id: LevelBandId;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound. `Infinity` for the top band. */
  max: number;
};

export const LEVEL_BANDS: readonly LevelBand[] = [
  { id: "beginner", min: 0, max: 950 },
  { id: "improver", min: 950, max: 1100 },
  { id: "confident", min: 1100, max: 1300 },
  { id: "strong", min: 1300, max: 1500 },
  { id: "elite", min: 1500, max: Infinity },
] as const;

export const LEVEL_BAND_IDS = LEVEL_BANDS.map((b) => b.id) as readonly LevelBandId[];

export function getLevelBand(elo: number): LevelBand {
  for (const band of LEVEL_BANDS) {
    if (elo >= band.min && elo < band.max) return band;
  }
  // Fallback: clamp negatives to beginner, anything past Infinity to elite.
  return elo < 0 ? LEVEL_BANDS[0] : LEVEL_BANDS[LEVEL_BANDS.length - 1];
}

/** Format the inclusive range for display (e.g. "950–1100" or "1500+"). */
export function formatLevelRange(band: LevelBand): string {
  if (band.max === Infinity) return `${band.min}+`;
  return `${band.min}–${band.max - 1}`;
}
