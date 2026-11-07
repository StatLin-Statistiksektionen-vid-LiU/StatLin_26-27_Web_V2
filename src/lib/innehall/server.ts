import "server-only";
import type Database from "better-sqlite3";
import { cache } from "react";
import { DEFAULT_SETTINGS } from "@/lib/data/content";
import { readDb } from "@/lib/data/db";
import { siteText, SITE_TEXTS, type SiteTextKey } from "@/lib/site-texts";
import type { SiteSettings } from "@/lib/types";
import { BRANSCHER } from "./block/branscher";
import { KOMPETENS } from "./block/kompetens";
import { MENY } from "./block/meny";
import { START } from "./block/start";
import { UBU } from "./block/ubu";
import { HANDSKRIFT } from "./block/handskrift";
import { ESTIG } from "./block/estig";
import type { BlockNyckel } from "./poster";
import { textRegel } from "./regler";
import type { BlockVarde } from "./typer";

/**
 * Blocken läses här. Ett block som aldrig ändrats har ingen rad, och då gäller standardvärdet i koden. Går raden inte att
 * läsa (en äldre version av innehållet, ett fel) visas också standardvärdet, så att sidan aldrig går sönder.
 */
export const BLOCK_DEF = { meny: MENY, start: START, kompetens: KOMPETENS, branscher: BRANSCHER, ubu: UBU, handskrift: HANDSKRIFT, estig: ESTIG } satisfies {
  [K in BlockNyckel]: { standard: () => BlockVarde[K]; schema: { safeParse: (v: unknown) => { success: boolean } } };
};

/** Blocken ligger i settings-tabellen under den här början, så getSettings hoppar över dem. */
export const BLOCK_PREFIX = "innehall:";

const arObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Ett block ur sin rad. Saknas en del som tillkommit i koden efter sparningen gäller standardvärdet för just den delen. */
export function tolkaBlock<K extends BlockNyckel>(nyckel: K, rad: string | null): BlockVarde[K] {
  const def = BLOCK_DEF[nyckel];
  const standard = def.standard() as BlockVarde[K];
  if (rad === null) return standard;
  try {
    const sparat: unknown = JSON.parse(rad);
    const tolkat = def.schema.safeParse(arObjekt(sparat) && arObjekt(standard) ? { ...standard, ...sparat } : sparat);
    if (tolkat.success) return tolkat.data as BlockVarde[K];
  } catch {
    /* faller igenom till standard */
  }
  console.warn(`[statlin] Innehållet ${nyckel} gick inte att läsa, standardinnehållet visas.`);
  return standard;
}

/**
 * Blocket som sidan visar det. Sidan och sparningen läser med samma funktion, så att servern kan se om någon annan hunnit
 * spara emellan. Knapparna under Om var sajttexter förut: tills startsidans block sparats första gången gäller de texterna.
 */
export function lasBlock<K extends BlockNyckel>(db: Database.Database, nyckel: K): BlockVarde[K] {
  const rad = db.prepare("SELECT value FROM settings WHERE key = ?").get(BLOCK_PREFIX + nyckel) as { value: string } | undefined;
  const varde = tolkaBlock(nyckel, rad?.value ?? null);
  if (nyckel === "start" && !rad) {
    const start = varde as BlockVarde["start"];
    const gamla = db.prepare("SELECT key, value FROM settings WHERE key IN ('text_start_om_knapp', 'text_start_om_knapp2')").all() as { key: string; value: string }[];
    for (const g of gamla) {
      const knapp = start.om[g.key === "text_start_om_knapp" ? 0 : 1];
      if (knapp && g.value.trim()) knapp.text = g.value.trim().slice(0, 40);
    }
  }
  return varde;
}

const lasCachat = cache(async (nyckel: BlockNyckel) => lasBlock(await readDb(), nyckel));

export async function getBlock<K extends BlockNyckel>(nyckel: K): Promise<BlockVarde[K]> {
  return (await lasCachat(nyckel)) as BlockVarde[K];
}

/**
 * Texten som en inställning visar på sidan. Sajttexterna får standardtexten när de är tomma, och det får även de
 * inställningar som måste ha en text. Sidan och sparningen räknar på samma sätt, så att servern kan se om någon annan
 * hunnit ändra texten.
 */
export function textVarde(s: SiteSettings, nyckel: string): string {
  if (Object.hasOwn(SITE_TEXTS, nyckel)) return siteText(s, nyckel as SiteTextKey);
  const varde = String((s as unknown as Record<string, string>)[nyckel] ?? "").trim();
  if (!varde && textRegel(nyckel)?.kravs) return String((DEFAULT_SETTINGS as unknown as Record<string, string>)[nyckel] ?? "").trim();
  return varde;
}
