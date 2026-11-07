import "server-only";
import { z } from "zod";

/**
 * Det som står skrivet för hand på sajten (src/components/content/handskrift.tsx): anteckningen med pilen mot loggan på
 * startsidan, och citaten i sidfoten, där ett av dem väljs slumpvis vid varje besök. _ och ^ ger index och exponent,
 * som β_1 och x^2. Utan text syns anteckningen inte, och citat utan text hoppas över.
 */
export const RITNINGAR = ["understrykning", "ring", "ingen"] as const;

const citat = z.object({
  text: z.string().trim().max(140, "Citatet får vara högst 140 tecken."),
  vem: z.string().trim().max(60, "Namnet får vara högst 60 tecken."),
  ritning: z.enum(RITNINGAR),
});

export const handskriftSchema = z.object({
  figur: z.string().trim().max(20, "Anteckningen får vara högst 20 tecken."),
  citat: z.array(citat).max(8, "Högst åtta citat."),
});

export const HANDSKRIFT = {
  schema: handskriftSchema,
  standard: (): z.output<typeof handskriftSchema> => ({
    figur: "P(kul) = 1",
    citat: [
      { text: "Alla modeller är fel, men vissa är användbara.", vem: "George E. P. Box", ritning: "understrykning" },
      { text: "Det är lätt att ljuga med statistik, men svårt att tala sanning utan den.", vem: "Andrejs Dunkels", ritning: "understrykning" },
      { text: "Utan data är du bara ännu en person med en åsikt.", vem: "W. Edwards Deming", ritning: "ring" },
    ],
  }),
};
