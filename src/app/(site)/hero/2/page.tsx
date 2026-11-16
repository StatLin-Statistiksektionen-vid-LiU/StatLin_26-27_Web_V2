import type { Metadata } from "next";
import { Startsida } from "@/components/home/startsida";
import { HeroStrom } from "@/components/prov-hero/hero-strom";
import { START_METADATA } from "@/lib/site-metadata";

// Samma metadata som startsidan: det här är startsidan när förslag 2 är valt, se src/lib/hero-val.ts.
export const metadata: Metadata = START_METADATA;

export default function StartsidaHero2() {
  return <Startsida hero={<HeroStrom />} val="2" />;
}
