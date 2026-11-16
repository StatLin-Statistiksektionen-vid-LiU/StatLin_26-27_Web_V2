import type { Metadata } from "next";
import { Startsida } from "@/components/home/startsida";
import { HeroStromOpus } from "@/components/prov-hero/hero-strom-opus";
import { START_METADATA } from "@/lib/site-metadata";

// Samma metadata som startsidan: det här är startsidan när förslag 3 är valt, se src/lib/hero-val.ts.
export const metadata: Metadata = START_METADATA;

export default function StartsidaHero3() {
  return <Startsida hero={<HeroStromOpus />} val="3" />;
}
