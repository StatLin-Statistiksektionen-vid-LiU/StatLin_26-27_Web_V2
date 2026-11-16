/**
 * Startsidans hero. Det finns tre förslag vid sidan av dagens, och styrelsen ska välja ett av dem. Valet görs med väljaren i
 * redigeringsläget (src/components/home/hero-valjare.tsx) och sparas i inställningen hero_variant. Tills någon har valt visas
 * förslag 1.
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

/** Heron som visas tills någon har valt i redigeringsläget, och om det sparade värdet är okänt. */
export const HERO_STANDARD: HeroVal = "1";

/** Sidan som visar den valda heron. Dagens hero ger null: då visas startsidan som den är. Utan val gäller HERO_STANDARD. */
export function heroVag(v: unknown): string | null {
  const val = arHeroVal(v) ? v : HERO_STANDARD;
  return val === "nu" ? null : `/hero/${val}`;
}
