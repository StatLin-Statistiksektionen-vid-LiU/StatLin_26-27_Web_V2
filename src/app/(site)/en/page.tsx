import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContentPage } from "@/components/content/content-page";
import { TranslateTip } from "@/components/content/translate-tip";
import { ArrowRight, Mail } from "@/components/icons";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getSettings } from "@/lib/data/content";
import { SITE_ALTERNATES, SITE_OG_EN } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: "StatLin in English",
  description: "StatLin is the student association for statistics students at Linköping University, on both the bachelor's and the master's programme.",
  alternates: { ...SITE_ALTERNATES, canonical: "/en", languages: { sv: "/", en: "/en" } },
  openGraph: SITE_OG_EN,
};

const LINKS = [
  { href: "/en/masters", label: "Master's students", text: "Start here if you study Statistics and Machine Learning." },
  { href: "/evenemang", label: "Events", text: "Everything that is happening. Anyone in the section can join." },
  { href: "/kontakt", label: "Contact", text: "The board and every committee, with e-mail addresses." },
  { href: "/utskott", label: "Committees", text: "Parties, sports, gaming, careers and education." },
];

export default function EnglishPage() {
  return (
    <div lang="en" data-engelsk-sida>
      <Suspense fallback={<HeroSkeleton english />}>
        <English />
      </Suspense>
    </div>
  );
}

async function English() {
  const settings = await getSettings();
  return (
    <ContentPage
      slug="en"
      kicker="In English"
      aside={
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] space-y-4">
          <ul className="overflow-hidden rounded-xl border border-line bg-white">
            {LINKS.map((l) => (
              <li key={l.href} className="border-b border-ink/10 last:border-0">
                <Link href={l.href} className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper/60">
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.label}</span>
                    <span className="mt-0.5 block text-sm text-stone">{l.text}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-red transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
          <TranslateTip />
          {settings.contact_email && (
            <a href={`mailto:${settings.contact_email}`} className="group flex items-center gap-4 rounded-xl border border-line bg-white p-5 transition-colors hover:border-ink/20">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red text-white">
                <Mail size={18} />
              </span>
              <span className="min-w-0">
                <span className="kicker block text-stone">Questions?</span>
                <span className="link-underline block truncate font-semibold">{settings.contact_email}</span>
              </span>
            </a>
          )}
        </div>
      }
    />
  );
}
