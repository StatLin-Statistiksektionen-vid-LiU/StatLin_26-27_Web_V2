/**
 * Standardläget, mörkt eller ljust, väljs under Inställningar i Admin, för datorn och telefonen var för sig. Det gäller besökare som
 * inte själva har tryckt på knappen för läget, se theme-toggle.tsx.
 *
 * Skalet med skriptet i head är förrenderat och kan inte läsa databasen. Därför lägger proxy.ts valet i en kaka på sidan som hämtas,
 * och skriptet i src/app/layout.tsx läser kakan innan något ritas. Mörkt på båda är standard och behöver ingen kaka.
 */
export const TEMA_KAKA = "statlin-tema-standard";

/** Kakans värde utan något val, mörkt på båda. */
export const TEMA_STANDARD = "mork.mork";

/** Kakans värde: datorns läge, en punkt och telefonens, till exempel mork.ljust. Allt utom "ljust" räknas som mörkt. */
export function temaKaka(dator: unknown, telefon: unknown): string {
  return `${dator === "ljust" ? "ljust" : "mork"}.${telefon === "ljust" ? "ljust" : "mork"}`;
}
