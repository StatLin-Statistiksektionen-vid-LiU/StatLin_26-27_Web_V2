import "server-only";
import { z } from "zod";
import { NAV } from "@/lib/navigation";
import { kravs, lank, text } from "./delar";

/** Menyn i sidhuvudet, telefonmenyn och sidfoten. Standard är NAV i navigation.ts. Dolda länkar och grupper sparas men visas inte. */
const menyLank = z.object({
  href: lank,
  label: kravs(60, "Länktexten"),
  description: text(140, "Beskrivningen").optional(),
  hidden: z.boolean().optional(),
});

const menyGrupp = z.object({
  label: kravs(40, "Gruppens namn"),
  href: lank,
  hidden: z.boolean().optional(),
  children: z.array(menyLank).max(24, "En grupp kan ha högst 24 länkar.").optional(),
});

export const MENY = {
  standard: () => structuredClone(NAV),
  schema: z.array(menyGrupp).min(1, "Menyn behöver minst en länk.").max(12, "Menyn kan ha högst 12 grupper."),
};
