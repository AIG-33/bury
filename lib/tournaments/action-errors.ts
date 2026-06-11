// =============================================================================
// Maps server-action error codes ("full", "deadline_passed",
// "locked_in_progress", …) to localized messages so users never see raw codes
// in alerts. Used by the tournament client components together with the
// `tournamentsPlayer.errors` / `tournamentsOrganized.errors` namespaces.
// =============================================================================

/**
 * Minimal structural type for a next-intl translator scoped to an `errors`
 * namespace. `t.has` lets us fall back to a generic message for unexpected
 * codes (e.g. raw Postgres error strings).
 */
export type ErrorTranslator = ((
  key: string,
  values?: Record<string, string | number>,
) => string) & {
  has: (key: string) => boolean;
};

/** Error codes are snake_case identifiers; anything else (a DB message, a Zod
 * issue, …) won't have a translation and falls back to `generic`, which keeps
 * the raw code visible for support/debugging. */
export function localizeActionError(t: ErrorTranslator, code: string): string {
  return t.has(code) ? t(code) : t("generic", { code });
}
