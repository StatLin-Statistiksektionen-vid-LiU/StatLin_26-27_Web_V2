import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContentPage } from "@/components/content/content-page";
import { SmartImage } from "@/components/content/smart-image";
import { Branscher } from "@/components/foretag/branscher";
import { StudenternasKompetens } from "@/components/foretag/studenternas-kompetens";
import { StarField } from "@/components/home/home-sections";
import { ArrowRight, ArrowUpRight, Mail } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";
import { ScrollToAnchor } from "@/components/ui/scroll-to-anchor";
import { HeroSkeleton } from "@/components/ui/skeletons";
import { getCommitteeBySlug, getSettings, listPartners } from "@/lib/data/content";
import { getStarEvent } from "@/lib/data/events";
import { mailtoWithSubject, starIsLive } from "@/lib/naringsliv";
import { STAR_COPY } from "@/lib/seed-content";
import { formatDateLong } from "@/lib/dates";
import { safeExternalUrl } from "@/lib/utils";
import { EditModeLink } from "@/components/edit-mode/editable";

export const metadata: Metadata = {
  title: "För företag",
  description: "Samarbeta med StatLin och nå Linköpings statistik- och datastudenter. STAR är StatLins arbetsmarknadsdag.",
};

export default function CompaniesPage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Companies />
    </Suspense>
  );
}

async function Companies() {
  const [partners, sasu, settings] = await Promise.all([listPartners({ activeOnly: true }), getCommitteeBySlug("sasu"), getSettings()]);
  const star = await getStarEvent(Number(settings.star_event_id) || null);
  const contact = sasu?.email || settings.contact_email;

  return (
    <ContentPage
      slug="foretag"
      kicker="Näringsliv"
      beforeBody={
        <>
          <StudenternasKompetens />
          <ScrollToAnchor id="kompetens" />
          <Branscher
            cta={{
              href: `mailto:${contact}?subject=${encodeURIComponent("Vi söker studenter")}`,
              label: "Kontakta SASU",
              rubrik: "Har ni en fråga som behöver en statistiker?",
              text: "Exjobb, sommarjobb eller ett case. Berätta vad ni vill lösa, så hjälper SASU er att nå rätt studenter.",
            }}
          />
        </>
      }
      aside={
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] rounded-xl border border-line bg-white p-6">
          <p className="kicker text-stone">Kontakt</p>
          <p className="display-tight mt-3 text-2xl">Näringslivs&shy;ansvarig</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-stone">
            SASU tar fram upplägg för lunchföreläsningar, case, annonser och STAR. Berätta vad ni vill uppnå så återkommer vi.
          </p>
          <a href={`mailto:${contact}?subject=${encodeURIComponent("Samarbete med StatLin")}`} className="btn btn-red mt-6 w-full">
            <Mail size={18} /> {contact}
          </a>
        </div>
      }
    >
      {/* STAR */}
      <section className="relative overflow-hidden bg-star-navy py-24 text-white md:py-32">
        {/* På telefon fyller texten hela bredden, så grafen skulle gå tvärs genom den. Loggan längre ner har samma motiv. */}
        <StarField figureClassName="max-md:hidden" />
        <div className="container-site relative grid items-center gap-12 md:grid-cols-12">
          <Reveal className="md:col-span-7">
            <p className="kicker text-white/60">{settings.star_subtitle || STAR_COPY.subtitle}</p>
            <p className="mt-6 text-[clamp(4rem,12vw,9rem)] font-light uppercase leading-none tracking-[0.2em] [font-stretch:110%]">
              {STAR_COPY.title}
            </p>
            <div className="mt-3 h-1 w-[min(100%,26rem)] bg-[#8f1d1d]" aria-hidden />
            {settings.star_intro && <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/80">{settings.star_intro}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {starIsLive(settings) && (
                <Link href="/star" className="btn btn-red">
                  Till STAR-sidan <ArrowRight size={18} />
                </Link>
              )}
              {star && (
                <Link href={`/evenemang/${star.slug}`} className="btn btn-light">
                  {formatDateLong(star.starts_at)} <ArrowUpRight size={18} />
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal delay={150} className="flex justify-center md:col-span-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/utskott/star.webp" alt="STAR-loggan" className="w-[min(70vw,22rem)] animate-float drop-shadow-[0_40px_60px_rgba(0,0,0,0.5)] pointer-coarse:filter-none" />
          </Reveal>
        </div>
      </section>

      {/* Lunchföreläsningar: här anmäler företagen intresse. Önskelistan är studenternas och ligger under Studenter. */}
      <section id="lunchforelasning" className="scroll-mt-[calc(var(--header-h)+1.5rem)] border-b border-line py-14 md:py-20">
        <ScrollToAnchor id="lunchforelasning" />
        <div className="container-site grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="kicker text-stone">Lunchföreläsningar</p>
            <h2 className="display-tight mt-3 text-3xl md:text-4xl">Håll en lunch&shy;föreläsning</h2>
            <p className="mt-3 max-w-md text-stone">Träffa studenterna över lunchen och berätta vad ni gör. Studenterna önskar själva ämnen, så ni kan se vad de vill höra om.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={mailtoWithSubject(contact, "Vi vill hålla en lunchföreläsning")} className="btn btn-red">
                <Mail size={18} /> Anmäl intresse
              </a>
              <Link href="/lunchforelasningar" className="btn btn-ghost">
                Se vad studenterna önskar <ArrowRight size={18} />
              </Link>
            </div>
            <p className="mt-3 text-sm text-stone">Anmälan öppnar ett mejl till {contact}.</p>
          </div>
          <ol className="space-y-5 md:col-span-6 md:col-start-7">
            {[
              "Ni väljer ämne: ert arbete, ett case eller hur vardagen ser ut hos er.",
              "SASU hjälper till med tid och plats och sprider inbjudan till studenterna.",
              "Upplägget bestämmer vi tillsammans. Berätta vad ni vill uppnå så återkommer vi.",
            ].map((row, i) => (
              <li key={row} className="flex gap-4">
                <span className="mono-accent text-lg font-semibold text-red" aria-hidden>
                  {i + 1}
                </span>
                <span className="text-lg leading-snug">{row}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Partners */}
      <section className="py-20 md:py-28">
        <div className="container-site">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="kicker text-stone">Sponsorer</p>
            <EditModeLink target={{ type: "page", slug: "foretag" }} href="/admin/partners" icon="edit">
              Hantera sponsorer
            </EditModeLink>
          </div>
          {partners.length > 0 ? (
            <ul className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
              {partners.map((p) => {
                const url = safeExternalUrl(p.url);
                const inner = (
                  <>
                    {p.logo ? (
                      <SmartImage image={p.logo} sizes="200px" className="h-16 w-auto max-w-[80%] object-contain grayscale transition-all duration-500 group-hover:grayscale-0 [[data-tema=mork]_&]:rounded-lg [[data-tema=mork]_&]:bg-ink [[data-tema=mork]_&]:px-3 [[data-tema=mork]_&]:py-2" alt={p.name} />
                    ) : (
                      <span className="display-tight min-w-0 max-w-full text-center text-lg [overflow-wrap:anywhere] sm:text-xl">{p.name}</span>
                    )}
                    {p.tier === "huvudpartner" && <span className="chip absolute left-3 top-3 bg-red text-white">Huvudsponsor</span>}
                  </>
                );
                return (
                  <li key={p.id} className="bg-white">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="group relative flex h-40 items-center justify-center p-6">
                        {inner}
                      </a>
                    ) : (
                      <div className="group relative flex h-40 items-center justify-center p-6">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-xl border border-dashed border-line bg-white p-8 md:flex-row md:items-center">
              <div>
                <p className="display-tight text-2xl">Er logga här?</p>
                <p className="mt-2 max-w-lg text-stone">Vi söker sponsorer som vill möta framtidens statistiker och data scientists. Hör av er så berättar vi mer.</p>
              </div>
              <a href={`mailto:${contact}`} className="btn btn-ink shrink-0">
                Kontakta SASU
              </a>
            </div>
          )}
        </div>
      </section>
    </ContentPage>
  );
}
