/**
 * Startsidans hero. Det finns tre förslag vid sidan av dagens, och styrelsen ska välja ett av dem. Valet görs med väljaren i
 * redigeringsläget (src/components/home/hero-valjare.tsx) och sparas i inställningen hero_variant.
 *
 * Dagens hero är startsidan själv. Förslagen ligger på /hero/1 till /hero/3, och proxyn (src/proxy.ts) visar det valda på
 * startsidan utan att adressen ändras. På så vis står varje hero kvar i sidans förrenderade skal.
 */
export const HERO_NYCKEL = "hero_variant";

export const HERO_VAL = ["nu", "1", "2", "3"] as const;
export type HeroVal = (typeof HERO_VAL)[number];

/** Texten på väljarens knappar. */
export const HERO_NAMN: Record<HeroVal, string> = { nu: "Dagens", "1": "1", "2": "2", "3": "3" };

export function arHeroVal(v: unknown): v is HeroVal {
  return typeof v === "string" && (HERO_VAL as readonly string[]).includes(v);
}

/** Sidan som visar ett förslag. Dagens hero och okända värden ger null: då visas startsidan som den är. */
export function heroVag(v: unknown): string | null {
  return arHeroVal(v) && v !== "nu" ? `/hero/${v}` : null;
}
