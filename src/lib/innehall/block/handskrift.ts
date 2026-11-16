import "server-only";
import { z } from "zod";

/**
 * Det som stod skrivet för hand i heron: anteckningen med pilen mot loggan på startsidan. Den visas inte längre, och blocket
 * ligger kvar bara för det som redan är sparat.
 * _ och ^ ger index och exponent, som β_1 och x^2, och utan text syns den inte.
 */
export const handskriftSchema = z.object({
  figur: z.string().trim().max(20, "Anteckningen får vara högst 20 tecken."),
});

export const HANDSKRIFT = {
  schema: handskriftSchema,
  standard: (): z.output<typeof handskriftSchema> => ({ figur: "" }),
};
