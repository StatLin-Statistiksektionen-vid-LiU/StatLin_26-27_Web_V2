import "server-only";
import { z } from "zod";
import { arGiltigLank, LANK_FEL } from "@/lib/innehall/lank";
import { kravs, text } from "./delar";

/**
 * Det som är eget för eSTIG:s sida (src/components/estig/): Discordknappen, och rubriken och texten till spelönskemålen. Discordlänken är tom från början, och utan länk syns knappen bara
 * i redigeringsläget, där eSTIG lägger in den.
 */
const lankEllerTom = z
  .string()
  .trim()
  .max(400, "Länken är för lång.")
  .refine((h) => !h || arGiltigLank(h), LANK_FEL);

export const estigSchema = z.object({
  discord: z.object({ text: text(30, "Knappens text"), href: lankEllerTom }),
  onskan: z.object({ rubrik: kravs(60, "Rubriken"), text: text(240, "Texten") }),
});

export const ESTIG = {
  schema: estigSchema,
  standard: (): z.output<typeof estigSchema> => ({
    discord: { text: "Discord", href: "" },
    onskan: {
      rubrik: "Önska ett spel",
      text: "Vilket spel ska vi köra på nästa spelkväll eller LAN, eller vilken film ska vi se? Du skriver anonymt, och det går direkt till eSTIG.",
    },
  }),
};
