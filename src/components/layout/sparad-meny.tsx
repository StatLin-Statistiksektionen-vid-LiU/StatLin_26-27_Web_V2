import { MenyTrad } from "@/components/layout/meny-trad";
import { getBlock } from "@/lib/innehall/server";

/** Den sparade menyn. Läses en gång per sidvisning (getBlock cachas), fast den står både i sidomenyn och i telefonens meny. */
export async function SparadMeny({ storlek }: { storlek: "sm" | "lg" }) {
  return <MenyTrad meny={await getBlock("meny")} storlek={storlek} />;
}
