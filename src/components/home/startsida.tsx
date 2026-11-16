import { Suspense, type ReactNode } from "react";
import { HomeSkeleton } from "@/components/ui/skeletons";
import type { HeroVal } from "@/lib/hero-val";
import { HeroValjare } from "./hero-valjare";
import { HomeSections } from "./home-sections";

/**
 * Startsidan: heron och under den genvägarna, kalendern med nytt, utskotten och korten. Samma sida ritas med dagens hero på / och
 * med vart och ett av förslagen på /hero/1 till /hero/3, se src/lib/hero-val.ts. Väljaren syns bara i redigeringsläget.
 */
export function Startsida({ hero, val }: { hero: ReactNode; val: HeroVal }) {
  return (
    <>
      {hero}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeSections />
      </Suspense>
      <HeroValjare nu={val} />
    </>
  );
}
