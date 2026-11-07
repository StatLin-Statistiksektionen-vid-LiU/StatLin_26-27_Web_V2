import "server-only";
import { z } from "zod";
import { arGiltigLank, LANK_FEL } from "@/lib/innehall/lank";

/** Delar till blockens scheman. Radbrytningar blir \n och mellanslag i kanterna tas bort, som i formulären. */
export const text = (max: number, etikett = "Texten") =>
  z
    .string()
    .overwrite((t) => t.replace(/\r\n?/g, "\n"))
    .trim()
    .max(max, `${etikett} får vara högst ${max} tecken.`);

export const kravs = (max: number, etikett = "Texten") => text(max, etikett).min(1, `${etikett} saknas.`);

export const lank = z.string().trim().max(400, "Länken är för lång.").refine(arGiltigLank, LANK_FEL);
