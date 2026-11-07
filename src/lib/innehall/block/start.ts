import "server-only";
import { z } from "zod";
import { lank } from "./delar";

/**
 * Knapparna och länkarna på startsidan. Texterna i korten längst ner är sajttexter och ändras där de står, men länkarna
 * står här. En knapp utan text visas inte.
 */
const knapp = z.object({ text: z.string().trim().max(40, "Knappens text får vara högst 40 tecken."), href: lank });

export const startSchema = z.object({
  hero: z.array(knapp).max(4, "Högst fyra knappar i heron."),
  om: z.array(knapp).max(3, "Högst tre knappar under texten om sektionen."),
  lankar: z.object({ ny: lank, star: lank, starLive: lank }),
});

export const START = {
  schema: startSchema,
  standard: (): z.output<typeof startSchema> => ({
    hero: [
      { text: "Engagera dig", href: "/utskott" },
      { text: "Ny student?", href: "/studenter/ny-student" },
      { text: "För företag", href: "/foretag" },
    ],
    om: [
      { text: "Om StatLin", href: "/sektionen" },
      { text: "Möt styrelsen", href: "/sektionen/styrelsen" },
    ],
    lankar: { ny: "/studenter/ny-student", star: "/foretag", starLive: "/star" },
  }),
};
