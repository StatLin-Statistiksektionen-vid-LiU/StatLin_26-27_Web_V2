import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { Startsida } from "@/components/home/startsida";
import { START_METADATA } from "@/lib/site-metadata";

export const metadata: Metadata = START_METADATA;

/** Startsidan med dagens hero. Har ett av förslagen valts i redigeringsläget visar proxyn i stället /hero/1 till /hero/3 här. */
export default function HomePage() {
  return <Startsida hero={<Hero />} val="nu" />;
}
