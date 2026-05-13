// Cyrillic → Latin transliteration for club slug generation.
// Follows the BGN/PCGN-ish rules popular for Russian/Belarusian names,
// tuned so that common tennis-club tokens ("Динамо", "Корт-Минск") become
// readable English-friendly slugs.
//
// Pure function, no I/O — generation is offered as a hint in the UI;
// uniqueness is enforced server-side against `public.clubs.slug`.

const CHAR_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  // Belarusian additions
  і: "i",
  ў: "u",
  ґ: "g",
  є: "ye",
  ї: "yi",
};

/**
 * Convert an arbitrary name into a candidate slug. Result is always:
 *   - lowercase
 *   - latin (a-z) + digits + dashes
 *   - no leading/trailing dashes
 *   - 3..40 chars
 *
 * Empty input → "club". The caller can append `-2`, `-3`, ... for
 * uniqueness; helper `dedupeSlug` does exactly that.
 */
export function nameToSlug(input: string): string {
  const lower = input.normalize("NFKC").toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (ch in CHAR_MAP) {
      out += CHAR_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += "-";
    }
  }
  // Collapse runs of dashes, trim ends.
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (out.length < 3) out = (out + "-club").replace(/^-|-$/g, "");
  if (out.length === 0) out = "club";
  if (out.length > 40) out = out.slice(0, 40).replace(/-$/, "");
  return out;
}

/**
 * Given a desired slug and a set of slugs that are already taken in the
 * database, return the smallest variant that is free. Example:
 *
 *   dedupeSlug("dynamo", new Set(["dynamo", "dynamo-2"])) === "dynamo-3"
 *
 * Used by the create-club server action *after* a uniqueness probe.
 */
export function dedupeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`.slice(0, 40).replace(/-$/, "");
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely; surface a clear error so the SA can react.
  throw new Error("dedupeSlug: ran out of suffixes");
}
