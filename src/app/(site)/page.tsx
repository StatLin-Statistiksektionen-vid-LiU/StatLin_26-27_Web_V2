import type { Metadata } from "next";
import { Suspense } from "react";
import { Hero } from "@/components/home/hero";
import { HomeSections } from "@/components/home/home-sections";
import { HomeSkeleton } from "@/components/ui/skeletons";
import { SITE_ALTERNATES } from "@/lib/site-metadata";

export const metadata: Metadata = {
  alternates: { ...SITE_ALTERNATES, canonical: "/", languages: { sv: "/", en: "/en" } },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Heron har texten om sektionen och siffrorna. Under den kommer kalendern, genvägarna, utskotten, nytt och korten. */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeSections />
      </Suspense>
    </>
  );
}
