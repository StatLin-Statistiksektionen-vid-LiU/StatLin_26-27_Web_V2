import type { Metadata } from "next";
import { Suspense } from "react";
import { Hero } from "@/components/home/hero";
import { HomeSections, HomeShortcuts } from "@/components/home/home-sections";
import { HomeSkeleton } from "@/components/ui/skeletons";
import { SITE_ALTERNATES } from "@/lib/site-metadata";

export const metadata: Metadata = {
  alternates: { ...SITE_ALTERNATES, canonical: "/", languages: { sv: "/", en: "/en" } },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Under heron kommer genvägarna och sedan sektionen. Tidslinjen med evenemang ligger i evenemangsdelen längre ner, så att sidan inte börjar med kalendern. */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeShortcuts />
        <HomeSections />
      </Suspense>
    </>
  );
}
