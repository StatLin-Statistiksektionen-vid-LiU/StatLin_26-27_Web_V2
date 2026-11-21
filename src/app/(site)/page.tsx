import type { Metadata } from "next";
import { Startsida } from "@/components/home/startsida";
import { HeroStromV1 } from "@/components/prov-hero/hero-strom-v1";
import { START_METADATA } from "@/lib/site-metadata";

export const metadata: Metadata = START_METADATA;

/**
 * Startsidan. Proxyn visar den valda heron här, från /hero/1 eller /hero/2 (src/lib/hero-val.ts). Den här sidan visas bara om
 * databasen inte går att läsa, och har då hero 1.
 */
export default function HomePage() {
  return <Startsida hero={<HeroStromV1 />} val="1" />;
}
