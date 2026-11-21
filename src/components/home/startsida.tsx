import { Suspense, type ReactNode } from "react";
import { HomeSkeleton } from "@/components/ui/skeletons";
import type { HeroVal } from "@/lib/hero-val";
import { HeroValjare } from "./hero-valjare";
import { HomeSections } from "./home-sections";

/**
 * Startsidan: heron och under den genvägarna, kalendern med nytt, utskotten och korten. Samma sida ritas med hero 1 på / och
 * /hero/1 och med hero 2 på /hero/2, se src/lib/hero-val.ts. Väljaren syns bara i redigeringsläget.
 */
export function Startsida({ hero, val }: { hero: ReactNode; val: HeroVal }) {
  return (
    <>
      {hero}
      {/* Hit leder scrollmarkören i heron. */}
      <div id="utforska" />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeSections />
      </Suspense>
      <HeroValjare nu={val} />
    </>
  );
}
