/**
 * Utilities for smart, collision-resistant nominee and event public codes.
 */

const STOP_WORDS = new Set(["OF", "THE", "AND", "IN", "FOR", "AT", "TO", "ON", "A", "AN", "WITH", "BY"]);

/**
 * Derives a clean, uppercase 2-5 character acronym from a name.
 * e.g. "St. Michael Catholic Youth Awards" -> "SMC"
 * e.g. "AMES Level 400 Awards" -> "AMES"
 * e.g. "Best Student Personality" -> "BSP"
 */
export function deriveAcronym(text: string, maxLen = 4): string {
  const clean = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .toUpperCase();
  
  const words = clean.split(/\s+/).filter((w) => w.length > 0 && !STOP_WORDS.has(w));
  
  if (words.length === 0) {
    return "VOTE";
  }

  // If multiple words, take the first letter of each word
  if (words.length > 1) {
    const letters = words.map((w) => w[0]).join("");
    return letters.slice(0, maxLen);
  }

  // Single word: take up to maxLen characters
  return words[0].slice(0, maxLen);
}

/**
 * Generates a unique, hierarchical public code for a nominee.
 * Format: [EVENT_ACRONYM]-[CAT_ACRONYM][NUMBER] (e.g. AMES-BP01 or SMC-01)
 */
export function generateSmartNomineeCode({
  eventName,
  categoryName,
  existingCodes = [],
}: {
  eventName?: string | null;
  categoryName?: string | null;
  existingCodes?: (string | null | undefined)[];
}): string {
  const eventPrefix = eventName ? deriveAcronym(eventName, 4) : "EVT";
  const catPrefix = categoryName ? deriveAcronym(categoryName, 3) : "";

  // Base prefix e.g. "AMES-BP" or "AMES"
  const prefix = catPrefix ? `${eventPrefix}-${catPrefix}` : eventPrefix;

  const used = new Set(
    existingCodes
      .filter((c): c is string => Boolean(c))
      .map((c) => c.toUpperCase().replace(/\s+/g, ""))
  );

  let sequence = 1;
  let candidate = `${prefix}${String(sequence).padStart(2, "0")}`;

  while (used.has(candidate) && sequence < 999) {
    sequence++;
    candidate = `${prefix}${String(sequence).padStart(2, "0")}`;
  }

  return candidate;
}
