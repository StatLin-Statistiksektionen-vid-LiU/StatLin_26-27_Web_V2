import { SITE_TEXT_GROUPS, SITE_TEXTS } from "@/lib/site-texts";
import { BLOCK, isBlockNyckel } from "./poster";

/**
 * Teckengränser och namn för det som ändras direkt på sidan. Läses av redigeringslistan, textredigeraren och servern,
 * men inte av besökarnas sidor.
 */
export type TextRegel = { etikett: string; max: number; kravs?: boolean };

/** Inställningar som inte är sajttexter men som står på sidorna. Gränserna är desamma som i Inställningar. */
const ANDRA_TEXTER: Record<string, TextRegel> = {
  hero_kicker: { etikett: "Startsidan: raden ovanför rubriken", max: 80 },
  hero_title: { etikett: "Startsidan: rubriken", max: 140, kravs: true },
  hero_text: { etikett: "Startsidan: ingressen", max: 300 },
  home_intro: { etikett: "Startsidan: texten om sektionen", max: 400, kravs: true },
  footer_slogan: { etikett: "Sidfoten: sloganen", max: 120 },
};

export function textRegel(nyckel: string): TextRegel | null {
  if (Object.hasOwn(SITE_TEXTS, nyckel)) {
    const def = SITE_TEXTS[nyckel as keyof typeof SITE_TEXTS];
    return { etikett: `${SITE_TEXT_GROUPS[def.group]}, ${def.label.charAt(0).toLowerCase()}${def.label.slice(1)}`, max: def.max };
  }
  return Object.hasOwn(ANDRA_TEXTER, nyckel) ? ANDRA_TEXTER[nyckel] : null;
}

/** Namnet på en post i listan över osparade ändringar. */
export function postEtikett(id: string): string {
  const nyckel = id.slice(2);
  if (id.startsWith("b:") && isBlockNyckel(nyckel)) return BLOCK[nyckel].etikett;
  if (id.startsWith("s:")) return textRegel(nyckel)?.etikett ?? "En text";
  return "Något på sidan";
}
