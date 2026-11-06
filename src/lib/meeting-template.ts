/** Dagordningsmallen: en punkt per rad. Varje nytt styrelsemöte börjar med de här punkterna, och ordföranden kan ändra dem. */
export const DEFAULT_MEETING_TEMPLATE = [
  "Mötets öppnande",
  "Val av mötesordförande",
  "Val av mötessekreterare",
  "Val av justerare",
  "Godkännande av dagordningen",
  "Föregående mötesprotokoll",
  "Rapporter från posterna och utskotten",
  "Ekonomi",
  "Beslutsärenden",
  "Övriga frågor",
  "Nästa möte",
  "Mötets avslutande",
].join("\n");

export const MEETING_TEMPLATE_MAX_ITEMS = 40;
export const MEETING_ITEM_TITLE_MAX = 200;

/** Raderna i mallen som punkter. Tomma rader hoppas över, och en numrering i början ("1.", "§ 2") tas bort eftersom sidan numrerar själv. */
export function parseMeetingTemplate(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(§\s*)?\d+\s*[.):]?\s+/, "").trim())
    .filter(Boolean)
    .slice(0, MEETING_TEMPLATE_MAX_ITEMS)
    .map((line) => line.slice(0, MEETING_ITEM_TITLE_MAX));
}
