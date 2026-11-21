/**
 * Startsidans hero. Det finns två, och styrelsen ska välja en av dem. Valet görs med väljaren i redigeringsläget
 * (src/components/home/hero-valjare.tsx) och sparas i inställningen hero_variant. Tills någon har valt visas hero 1.
 *
 * De två ligger på /hero/1 och /hero/2, och proxyn (src/proxy.ts) visar den valda på startsidan utan att adressen ändras. På
 * så vis står varje hero kvar i sidans förrenderade skal.
 */
export const HERO_NYCKEL = "hero_variant";

export const HERO_VAL = ["1", "2"] as const;
export type HeroVal = (typeof HERO_VAL)[number];

/** Texten på väljarens knappar. */
export const HERO_NAMN: Record<HeroVal, string> = { "1": "1", "2": "2" };

export function arHeroVal(v: unknown): v is HeroVal {
  return typeof v === "string" && (HERO_VAL as readonly string[]).includes(v);
}

/**
 * Heron som visas tills någon har valt i redigeringsläget, och om det sparade värdet är okänt. Dit hör värdena för heroerna som
 * har tagits bort, "nu" och "3".
 */
export const HERO_STANDARD: HeroVal = "1";

/** Sidan som visar den valda heron. Utan val gäller HERO_STANDARD. */
export function heroVag(v: unknown): string {
  return `/hero/${arHeroVal(v) ? v : HERO_STANDARD}`;
}
