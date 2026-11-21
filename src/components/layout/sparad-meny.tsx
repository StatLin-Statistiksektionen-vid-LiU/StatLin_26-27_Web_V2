import { MenyRad } from "@/components/layout/meny-rad";
import { MenyTrad } from "@/components/layout/meny-trad";
import { getBlock } from "@/lib/innehall/server";

/* Den sparade menyn. Den läses en gång per sidvisning (getBlock cachas), fast den står både i listens rad och i panelens träd. */

export async function SparadMenyRad() {
  return <MenyRad meny={await getBlock("meny")} />;
}

export async function SparadMeny() {
  return <MenyTrad meny={await getBlock("meny")} />;
}
