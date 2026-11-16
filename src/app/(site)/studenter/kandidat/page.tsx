import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentPage } from "@/components/content/content-page";
import { MINSTA_KVADRAT } from "@/components/content/formula-art";
import { FormulaCard } from "@/components/content/formula-card";
import { UbuCard } from "@/components/content/ubu-card";
import { QuickLinksCard } from "@/components/links/quick-links";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getEducationCommittee } from "@/lib/data/content";
import { listFeaturedLinks } from "@/lib/data/links";

export const metadata: Metadata = {
  title: "Kandidatprogrammet",
  description: "Statistik och dataanalys, 180 hp, vid Linköpings universitet: programmet, studiebevakning och stöd.",
};

const LINKS = [
  { href: "/tentastatistik", label: "Tentastatistik" },
  { href: "/studenter/hjalpmedel", label: "Hjälpmedel" },
  { href: "https://studieinfo.liu.se/program/F7KSA", label: "Programmet i Studieinfo" },
];

export default function BachelorPage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Bachelor />
    </Suspense>
  );
}

async function Bachelor() {
  const [ubu, shortcuts] = await Promise.all([getEducationCommittee(), listFeaturedLinks()]);
  return (
    <ContentPage
      slug="utbildning"
      kicker="Studenter / Kandidat"
      heroAside={
        <div className="flex md:justify-end">
          <Formula />
        </div>
      }
      aside={
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] space-y-4">
          {!!ubu?.visible && <UbuCard ubu={ubu} />}
          <QuickLinksCard links={shortcuts} extra={LINKS} />
        </div>
      }
    />
  );
}

/** Dekor: minsta kvadrat-skattningen som "formelkort". */
function Formula() {
  return (
    <FormulaCard
      kicker="Minsta kvadrat"
      tilt="right"
      art={MINSTA_KVADRAT}
      facts={
        <>
          R² = 0,94 · n = 180 hp
          <br />
          <span className="text-red-deep">p &lt; 0,001</span>
        </>
      }
    />
  );
}
