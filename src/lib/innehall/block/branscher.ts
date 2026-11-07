import "server-only";
import { z } from "zod";
import { BRANSCHER as STANDARD } from "@/lib/foretag-kompetens";
import { kravs, text } from "./delar";

export const FIGUR_NAMN = ["prognos", "urval", "overlevnad", "regression", "natverk", "kluster"] as const;

const kontakt = z.object({ rubrik: text(120, "Rubriken"), text: text(300), knapp: kravs(40, "Knappens text") });

/**
 * Branscherna under Vad studenterna kan, med raden längst ner som ber företagen höra av sig. Figuren är dekor och väljs
 * bland de sex som finns. Kontakten står på /foretag och starKontakt i STAR-inbjudan, med var sin länk i koden.
 */
export const branscherSchema = z.object({
  kicker: text(60, "Raden ovanför"),
  rubrik: kravs(120, "Rubriken"),
  ingress: text(500, "Ingressen"),
  lista: z.array(z.object({ namn: kravs(60, "Branschens namn"), text: text(400), figur: z.enum(FIGUR_NAMN, "Välj en figur.") })).max(12, "Högst tolv branscher."),
  kontakt,
  starKontakt: kontakt,
});

export const BRANSCHER = {
  schema: branscherSchema,
  standard: (): z.output<typeof branscherSchema> => ({
    kicker: "Branscher",
    rubrik: "Statistik är ett verktyg, inte en bransch",
    ingress:
      "Metoderna är desamma oavsett om datan kommer från kunder, patienter eller sensorer. Därför kommer våra studenter snabbt in i nya områden. Här gör färdigheterna nytta direkt.",
    lista: STANDARD.map((b) => ({ ...b })),
    kontakt: {
      rubrik: "Har ni en fråga som behöver en statistiker?",
      text: "Exjobb, sommarjobb eller ett case. Berätta vad ni vill lösa, så hjälper SASU er att nå rätt studenter.",
      knapp: "Kontakta SASU",
    },
    starKontakt: {
      rubrik: "Känner ni igen er?",
      text: "Några rader räcker, så hör SASU av sig och berättar hur ni kan vara med.",
      knapp: "Anmäl intresse",
    },
  }),
};
