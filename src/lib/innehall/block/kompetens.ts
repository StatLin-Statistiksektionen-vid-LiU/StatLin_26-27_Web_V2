import "server-only";
import { z } from "zod";
import { FARDIGHETER, GULDKORN, LAGE_TEXT, NIVA_ID, NIVAER, PROGRAM } from "@/lib/foretag-kompetens";
import { kravs, text } from "./delar";

/**
 * Vad studenterna kan, på /foretag och i STAR-inbjudan. Sökningen läser samma färdigheter. Standard är innehållet i
 * foretag-kompetens.ts. Stegen är alltid fyra, i ordningen i NIVA_ID, och varje färdighet har ett läge per steg.
 */
const niva = z.object({
  etikett: kravs(16, "Stegets namn"),
  undertitel: text(24, "Undertiteln"),
  rubrik: kravs(80, "Rubriken"),
  text: text(600),
  uppdrag: text(200, "Uppdraget"),
  passar: text(120, "Passar för"),
});

const program = z.object({
  niva: z.enum(NIVA_ID, "Välj ett av stegen."),
  typ: text(60, "Raden ovanför"),
  namn: kravs(80, "Programmets namn"),
  roll: text(120, "Rollen"),
  text: text(700),
  nyckelord: z.array(kravs(40, "Nyckelordet")).max(16, "Högst 16 nyckelord."),
});

const fardighet = z.object({
  namn: kravs(60, "Färdigheten"),
  lagen: z.string().regex(/^[jvn]{4}$/, "Välj ett läge för vart och ett av de fyra stegen."),
});

export const kompetensSchema = z.object({
  kicker: text(80, "Raden ovanför"),
  rubrik: kravs(160, "Rubriken"),
  ingress: text(600, "Ingressen"),
  programKnapp: text(30, "Knappen"),
  program: z.array(program).max(4, "Högst fyra program."),
  fardigheterRubrik: kravs(80, "Rubriken"),
  fardigheterIngress: text(400, "Texten"),
  uppdragEtikett: text(40, "Rubriken"),
  passarEtikett: text(40, "Rubriken"),
  nivaer: z.array(niva).length(4, "Stegen ska vara fyra."),
  grupper: z
    .array(z.object({ namn: kravs(40, "Gruppens namn"), fardigheter: z.array(fardighet).max(40, "Högst 40 färdigheter i en grupp.") }))
    .min(1, "Behåll minst en grupp.")
    .max(10, "Högst tio grupper."),
  lageText: z.object({ j: kravs(60, "Förklaringen"), v: kravs(60, "Förklaringen"), n: kravs(60, "Förklaringen") }),
  nyText: text(60, "Förklaringen"),
  kalla: text(600, "Källan"),
  guldkornKicker: text(80, "Raden ovanför"),
  guldkornRubrik: text(120, "Rubriken"),
  guldkorn: z.array(z.object({ kalla: text(40, "Raden ovanför"), rubrik: kravs(100, "Rubriken"), text: text(400) })).max(12, "Högst tolv kort."),
});

export const KOMPETENS = {
  schema: kompetensSchema,
  standard: (): z.output<typeof kompetensSchema> => ({
    kicker: "Två program vid Linköpings universitet",
    rubrik: "De bygger modellen.\nOch de vet när den har fel.",
    ingress:
      "Det är skillnaden mellan någon som kör kod och någon ni kan lämna en fråga till. Studenterna läser statistik på djupet, programmerar i R, Python och SQL och tränar på att förklara resultatet för den som ska fatta beslutet.",
    programKnapp: "Se vad de kan",
    program: PROGRAM.map((p) => ({ ...p, nyckelord: [...p.nyckelord] })),
    fardigheterRubrik: "Vad våra studenter kan",
    fardigheterIngress: "Kurserna ändras över åren, men färdigheterna består. Bläddra genom utbildningen och se vad studenten kan efter varje steg.",
    uppdragEtikett: "Ett uppdrag de klarar",
    passarEtikett: "Passar för",
    nivaer: NIVAER.map(({ etikett, undertitel, rubrik, text, uppdrag, passar }) => ({ etikett, undertitel, rubrik, text, uppdrag, passar })),
    grupper: FARDIGHETER.map((g) => ({ namn: g.grupp, fardigheter: g.rader.map((r) => ({ namn: r.namn, lagen: r.lagen as string })) })),
    lageText: { ...LAGE_TEXT },
    nyText: "Nytt i det här steget",
    kalla:
      "Sammanställt ur kursplanerna för LiU:s kandidatprogram i statistik och dataanalys och masterprogram i statistik och maskininlärning. Masterprogrammet går på engelska, och studenterna kommer från statistik, matematik, datavetenskap eller teknik.",
    guldkornKicker: "Ur utbildnings- och kursplanerna",
    guldkornRubrik: "Det som sällan står i ett CV",
    guldkorn: GULDKORN.map((g) => ({ ...g })),
  }),
};
