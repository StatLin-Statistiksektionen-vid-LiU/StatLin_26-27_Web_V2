import { AnteckningLager } from "@/components/content/anteckning-lager";
import { getBlock } from "@/lib/innehall/server";

/** Anteckningarna för hand med pil, för alla sidor. Lagret i webbläsaren väljer ut sidans och letar upp orden de pekar på. */
export async function SidansAnteckningar() {
  return <AnteckningLager server={await getBlock("anteckningar")} />;
}
