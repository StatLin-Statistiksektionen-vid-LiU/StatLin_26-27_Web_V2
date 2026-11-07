import "server-only";
import { z } from "zod";
import { lank } from "./delar";

/**
 * UBU:s egna knappar, på utskottets sida och i UBU-kortet på Kandidat och Master. Från början finns knappen till
 * kursutvärderingarna. En knapp utan text visas inte.
 */
const knapp = z.object({ text: z.string().trim().max(40, "Knappens text får vara högst 40 tecken."), href: lank });

export const ubuSchema = z.object({ knappar: z.array(knapp).max(3, "Högst tre knappar.") });

export const UBU = {
  schema: ubuSchema,
  standard: (): z.output<typeof ubuSchema> => ({
    knappar: [{ text: "Kursutvärderingar", href: "https://admin.evaliuate.liu.se/search?lang=sv" }],
  }),
};
