import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContentPage } from "@/components/content/content-page";
import { EventRow } from "@/components/content/event-card";
import { UbuCard } from "@/components/content/ubu-card";
import { ArrowRight } from "@/components/icons";
import { QuickLinksCard } from "@/components/links/quick-links";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getEducationCommittee } from "@/lib/data/content";
import { listUpcomingEvents } from "@/lib/data/events";
import { listFeaturedLinks } from "@/lib/data/links";
import { SITE_ALTERNATES } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: "Masterprogrammet",
  description: "Statistics and Machine Learning, 120 hp, vid Linköpings universitet. StatLin är sektionen för masterstudenterna också.",
  alternates: { ...SITE_ALTERNATES, languages: { sv: "/studenter/master", en: "/en/masters" } },
};

const LINKS = [
  { href: "/tentastatistik", label: "Tentastatistik" },
  { href: "/studenter/hjalpmedel?program=master", label: "Hjälpmedel" },
  { href: "https://studieinfo.liu.se/program/F7MML", label: "Programmet i Studieinfo" },
];

export default function MasterPage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Master />
    </Suspense>
  );
}

async function Master() {
  const [ubu, events, shortcuts] = await Promise.all([getEducationCommittee(), listUpcomingEvents(3), listFeaturedLinks()]);
  return (
    <ContentPage
      slug="master"
      kicker="Studenter / Master"
      // Programmet ges på engelska, så vägen till den engelska sidan står först, uppe i hjälten.
      heroAside={
        <div className="flex md:justify-end">
          <Link href="/en/masters" hrefLang="en" lang="en" className="noise group relative block w-full max-w-sm overflow-hidden rounded-2xl bg-red p-6 text-white">
            <div className="grid-paper pointer-events-none absolute inset-0 text-white" aria-hidden />
            <p className="kicker relative text-white">The programme is taught in English</p>
            <p className="display-tight relative mt-3 text-2xl">Read this page in English</p>
            <span className="relative mt-4 inline-flex items-center gap-2 font-semibold">
              For master&apos;s students <ArrowRight size={18} className="transition-transform duration-500 group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      }
      // Bredvid texten står det som händer härnäst och vem man vänder sig till. Länkarna ligger på en egen rad under, så att spalten inte blir längre än texten.
      aside={
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] space-y-4">
          <div className="rounded-xl border border-line bg-white p-6">
            <p className="kicker text-stone">Nästa på schemat</p>
            <div className="mt-2">
              {events.length > 0 ? events.map((e) => <EventRow key={e.id} event={e} compact />) : <p className="py-6 text-stone">Nya evenemang kommer snart.</p>}
            </div>
            <Link href="/evenemang" className="btn btn-ink mt-5 w-full">
              Hela kalendern <ArrowRight size={18} />
            </Link>
          </div>
          {!!ubu?.visible && <UbuCard ubu={ubu} />}
        </div>
      }
    >
      <section className="border-t border-line">
        <div className="container-site grid py-16 md:py-20 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <QuickLinksCard links={shortcuts} extra={LINKS} />
          </div>
        </div>
      </section>
    </ContentPage>
  );
}
