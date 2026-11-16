import "server-only";
import { cache } from "react";
import { getCommitteeById } from "@/lib/data/content";
import { karaktarFor } from "@/lib/karaktar";

/**
 * Kontots karaktär i portalen: färgen, motivet och loggan det ritas runt. Den som har ett eget utskott får utskottets, och
 * styrelsens poster får sin egen runt StatLins logga. Skalet och översikten frågar båda, så svaret sparas under renderingen.
 */
export const kontoKaraktar = cache(async (post: string, committeeId: number | null) => {
  const utskott = committeeId ? await getCommitteeById(committeeId) : null;
  return { ...karaktarFor(post, utskott), logo: utskott && utskott.kind !== "styrelse" ? utskott.logo_url : "/brand/statlin.svg" };
});
