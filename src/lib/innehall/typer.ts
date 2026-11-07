import type { z } from "zod";
import type { branscherSchema } from "./block/branscher";
import type { kompetensSchema } from "./block/kompetens";
import type { MENY } from "./block/meny";
import type { startSchema } from "./block/start";
import type { ubuSchema } from "./block/ubu";
import type { handskriftSchema } from "./block/handskrift";
import type { estigSchema } from "./block/estig";

/**
 * Blockens typer. Bara typer, så att klientkomponenter kan läsa dem utan att zod eller databasen följer med.
 */
export type Kompetens = z.output<typeof kompetensSchema>;
export type Branscher = z.output<typeof branscherSchema>;
export type Meny = z.output<(typeof MENY)["schema"]>;
export type Start = z.output<typeof startSchema>;
export type Ubu = z.output<typeof ubuSchema>;
export type Handskrift = z.output<typeof handskriftSchema>;
export type Estig = z.output<typeof estigSchema>;

export type BlockVarde = { kompetens: Kompetens; branscher: Branscher; meny: Meny; start: Start; ubu: Ubu; handskrift: Handskrift; estig: Estig };
