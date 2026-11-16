import type { Metadata } from "next";
import { Startsida } from "@/components/home/startsida";
import { HeroStromV1 } from "@/components/prov-hero/hero-strom-v1";
import { START_METADATA } from "@/lib/site-metadata";

// Samma metadata som startsidan: det här är startsidan när förslag 1 är valt, se src/lib/hero-val.ts.
export const metadata: Metadata = START_METADATA;

export default function StartsidaHero1() {
  return <Startsida hero={<HeroStromV1 />} val="1" />;
}
