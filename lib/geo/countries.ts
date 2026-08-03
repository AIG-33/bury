// =============================================================================
// Country reference (ISO 3166-1 alpha-2) built on Intl.DisplayNames.
//
// We deliberately do NOT hardcode a country list: valid region codes are
// derived by probing every AA..ZZ combination against Intl.DisplayNames —
// a code is a real region when the runtime knows a display name for it
// (fallback "code" returns the code itself for unassigned combinations).
// Names are localized the same way, so ru/en (and any future locale) come
// for free from the runtime's CLDR data.
// =============================================================================

import { z } from "zod";

export const DEFAULT_COUNTRY = "BY";

/** Countries pinned to the top of every selector, in this exact order. */
export const PRIORITY_COUNTRIES: readonly string[] = ["BY", "RU", "PL", "LT", "LV", "UA", "KZ"];

// Region codes Intl.DisplayNames resolves that are not countries we want to
// offer (supranational/meta regions).
const EXCLUDED_CODES = new Set(["EU", "EZ", "UN", "QO", "ZZ", "XA", "XB"]);

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let cachedCodes: string[] | null = null;

/** All valid ISO alpha-2 country codes known to the runtime (unordered-ish, A→Z). */
export function getAllCountryCodes(): string[] {
  if (cachedCodes) return cachedCodes;
  const probe = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });
  const codes: string[] = [];
  for (const a of LETTERS) {
    for (const b of LETTERS) {
      const code = `${a}${b}`;
      if (EXCLUDED_CODES.has(code)) continue;
      let name: string | undefined;
      try {
        name = probe.of(code) ?? undefined;
      } catch {
        continue;
      }
      if (name && name !== code) codes.push(code);
    }
  }
  cachedCodes = codes;
  return codes;
}

export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && getAllCountryCodes().includes(code);
}

/** Localized country name; falls back to the raw code for unknown values. */
export function getCountryName(code: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Shared Zod schema for forms/actions that persist a country code. */
export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidCountryCode, { message: "invalid_country" })
  .default(DEFAULT_COUNTRY);

export type CountryOption = { code: string; name: string };

/**
 * Full selector list: priority countries first (fixed order), then the rest
 * sorted alphabetically by their localized name.
 */
export function getCountryOptions(locale: string): CountryOption[] {
  const dn = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
  const nameOf = (code: string): string => {
    try {
      return dn.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const prioritySet = new Set(PRIORITY_COUNTRIES);
  const priority = PRIORITY_COUNTRIES.map((code) => ({ code, name: nameOf(code) }));
  const rest = getAllCountryCodes()
    .filter((code) => !prioritySet.has(code))
    .map((code) => ({ code, name: nameOf(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return [...priority, ...rest];
}
