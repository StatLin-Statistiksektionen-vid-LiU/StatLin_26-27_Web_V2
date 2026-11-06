import type { Metadata } from "next";
import { FixedBoxLink } from "@/components/fragelada/box-link";
import Link from "next/link";
import { Suspense } from "react";
import { ContentPage } from "@/components/content/content-page";
import { EventRow } from "@/components/content/event-card";
import { IfUbuBoxOpen } from "@/components/content/ubu-card";
import { TranslateTip } from "@/components/content/translate-tip";
import { ArrowRight, Mail } from "@/components/icons";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getEducationCommittee } from "@/lib/data/content";
import { listUpcomingEvents } from "@/lib/data/events";
import { SITE_ALTERNATES, SITE_OG_EN } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: "Master's students",
  description: "For students on the master's programme Statistics and Machine Learning at Linköping University: events, contacts and how to get involved in StatLin.",
  alternates: { ...SITE_ALTERNATES, canonical: "/en/masters", languages: { sv: "/studenter/master", en: "/en/masters" } },
  openGraph: SITE_OG_EN,
};

export default function MastersPage() {
  return (
    <div lang="en" data-engelsk-sida>
      <Suspense fallback={<HeroSkeleton english />}>
        <Masters />
      </Suspense>
    </div>
  );
}

async function Masters() {
  const [ubu, events] = await Promise.all([getEducationCommittee(), listUpcomingEvents(4)]);
  return (
    <ContentPage
      slug="en-masters"
      kicker="In English / Master's students"
      aside={
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] space-y-4">
          <div className="rounded-xl border border-line bg-white p-6">
            <p className="kicker text-stone">Next up</p>
            <div className="mt-2">
              {events.length > 0 ? events.map((e) => <EventRow key={e.id} event={e} locale="en-GB" compact />) : <p className="py-6 text-stone">New events are coming soon.</p>}
            </div>
            <Link href="/evenemang" className="btn btn-ink mt-5 w-full">
              Full calendar <ArrowRight size={18} />
            </Link>
          </div>
          {!!ubu?.visible && (
            <div className="overflow-hidden rounded-xl border border-line bg-white p-6">
              <div className="flex items-center gap-4">
                {ubu.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ubu.logo_url} alt="" className="size-16 rounded-xl object-contain p-1 [[data-tema=mork]_&]:bg-ink" />
                )}
                <div>
                  <p className="kicker text-stone">Your education</p>
                  <p className="display-tight mt-1 text-2xl normal-case" translate="no">
                    {ubu.short_name}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-stone">
                Questions about courses, exams or your study environment? Contact UBU
                <IfUbuBoxOpen otherwise=" in Swedish or English.">, anonymously if you prefer, in Swedish or English.</IfUbuBoxOpen>
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {ubu.email && (
                  <a href={`mailto:${ubu.email}`} className="btn btn-red btn-sm">
                    <Mail size={15} /> Email {ubu.short_name}
                  </a>
                )}
                <FixedBoxLink slug="ubu" className="btn btn-light btn-sm">
                  Write anonymously
                </FixedBoxLink>
                <Link href={`/utskott/${ubu.slug}`} className="btn btn-ghost-dark btn-sm">
                  About {ubu.short_name}
                </Link>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-white p-6">
            <p className="kicker text-stone">Study resources</p>
            <p className="mt-3 leading-relaxed text-stone">Cheat sheets, GitHub links and guides for your programme, sorted by year and term. The page itself is in Swedish.</p>
            <Link href="/studenter/hjalpmedel?program=master" className="btn btn-ink mt-5 w-full">
              See the resources <ArrowRight size={18} />
            </Link>
          </div>
          <TranslateTip />
        </div>
      }
    />
  );
}
