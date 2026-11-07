import "server-only";
import { z } from "zod";

/**
 * Anteckningarna för hand med en pil mot ett ord, som någon har skrivit i marginalen (src/components/content/anteckning-lager.tsx).
 * Varje anteckning står på en sida och pekar på ett ord där, eller på slutet av rubriken när ordet är tomt. nr är vilken av
 * ordets förekomster på sidan, räknat från 0. x och y är var anteckningen står i förhållande till ordet, i pixlar, sedan den
 * dragits dit i redigeringsläget. Utan dem väljs en plats kring ordet, som från början.
 */
const anteckning = z.object({
  sida: z
    .string()
    .trim()
    .max(120, "Sidans adress får vara högst 120 tecken.")
    .regex(/^\/[\p{L}\p{N}\-_/]*$/u, "Sidan ska vara en adress på sajten, som /nyheter."),
  text: z.string().trim().min(1, "Anteckningen behöver en text.").max(40, "Anteckningen får vara högst 40 tecken."),
  mal: z.string().trim().max(40, "Ordet får vara högst 40 tecken."),
  nr: z.number().int().min(0).max(99).optional(),
  x: z.number().int().min(-4000).max(4000).optional(),
  y: z.number().int().min(-4000).max(4000).optional(),
  rod: z.literal(true).optional(),
});

export const anteckningarSchema = z.object({
  lista: z.array(anteckning).max(40, "Högst 40 anteckningar."),
});

type Anteckningar = z.output<typeof anteckningarSchema>;

/** Anteckningarna från början, och vilken sajttext var och en hade innan de flyttades hit. */
const FRAN_BORJAN: { text: Anteckningar["lista"][number]; nyckel: string }[] = [
  { nyckel: "text_nyheter_anteckning", text: { sida: "/nyheter", text: "(färskt ur pressen)", mal: "" } },
  { nyckel: "text_galleri_anteckning", text: { sida: "/galleri", text: "(bevis på att P(kul) = 1)", mal: "", rod: true } },
  { nyckel: "text_dokument_anteckning", text: { sida: "/dokument", text: "(spännande läsning, lovar)", mal: "" } },
  { nyckel: "text_styrelsen_anteckning", text: { sida: "/sektionen/styrelsen", text: "(vi bits inte)", mal: "" } },
  { nyckel: "text_om_anteckning", text: { sida: "/sektionen", text: "(topp 5 sektion)", mal: "statlin" } },
];

/** Sajttexterna som anteckningarna stod i förut. Läses tills blocket sparats första gången. */
export const GAMLA_NYCKLAR = FRAN_BORJAN.map((f) => f.nyckel);

/**
 * Anteckningarna med texterna som ändrats i Admin innan de flyttades hit. Ett - tog bort anteckningen, och *text* var rödpenna.
 */
export function franGamlaTexter(gamla: Record<string, string>): Anteckningar {
  const lista: Anteckningar["lista"] = [];
  for (const { nyckel, text } of FRAN_BORJAN) {
    const sparad = gamla[nyckel]?.trim();
    if (!sparad) {
      lista.push({ ...text });
      continue;
    }
    if (sparad === "-") continue;
    const ren = sparad.replace(/\*+([^*]+)\*+/g, "$1").trim().slice(0, 40);
    if (!ren) continue;
    const ny = { sida: text.sida, text: ren, mal: text.mal };
    lista.push(/\*[^*]+\*/.test(sparad) ? { ...ny, rod: true } : ny);
  }
  return { lista };
}

export const ANTECKNINGAR = {
  schema: anteckningarSchema,
  standard: (): Anteckningar => ({ lista: FRAN_BORJAN.map((f) => ({ ...f.text })) }),
};
