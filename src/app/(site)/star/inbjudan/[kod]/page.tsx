import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Branscher } from "@/components/foretag/branscher";
import { StudenternasKompetens } from "@/components/foretag/studenternas-kompetens";
import { ArrowRight, Calendar, Check, ChevronDown, Mail } from "@/components/icons";
import { EventFacts, StarHero } from "@/components/star/star-hero";
import { StarHimmel } from "@/components/star/star-himmel";
import { StarRorelse } from "@/components/star/star-rorelse";
import "@/components/star/star.css";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { getStarEvent } from "@/lib/data/events";
import { getStarInviteCode, listStarCompanies } from "@/lib/data/naringsliv";
import { getBlock } from "@/lib/innehall/server";
import { mailtoWithSubject, starIsLive } from "@/lib/naringsliv";
import { SITE_OG } from "@/lib/site-metadata";
import { STAR_COPY } from "@/lib/seed-content";
import type { IntresseFel } from "@/lib/star-intresse";
import { IntresseForm } from "./intresse-form";

const TITLE = "Inbjudan till STAR";
const DESCRIPTION = "Träffa Linköpings studenter i statistik, dataanalys och maskininlärning innan någon annan gör det. Så här kan ni vara med på STAR.";

/** Länken skickas bara till företag vi bjuder in. Sökmotorerna ska inte hitta den, men i ett mejl eller i Teams ska den se bra ut. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { ...SITE_OG, title: TITLE, description: DESCRIPTION },
};

// Sidan har inga skelett: en fel kod ska bli ett riktigt 404 och inte ett skelett som byts mot "sidan finns inte".
export const instant = false;

const H2 = "star-type text-[clamp(1.9rem,5vw,3.5rem)] font-light uppercase leading-[1.05] tracking-[0.06em]";

const SKAL = [
  {
    rubrik: "Alla i rummet är rätt personer",
    text: "StatLin är sektionen för statistik, dataanalys och maskininlärning vid Linköpings universitet. Ni behöver inte sålla bland hela campus: alla som kommer till STAR läser det ni letar efter.",
  },
  {
    rubrik: "Ni får tid att prata på riktigt",
    text: "Sektionen är liten, så ni blir inte en monter bland hundra i en mässhall. Ni får samtal med studenter som har kommit för att höra vad just ni gör med data.",
  },
  {
    rubrik: "Ni hinner före",
    text: "Exjobb, sommarjobb och första jobbet avgörs tidigt. Det företag studenterna minns från STAR är det de söker sig till när det är dags att välja.",
  },
];

const UTBYTE = [
  {
    kicker: "Exjobb",
    rubrik: "En analys av en riktig fråga hos er",
    text: "Kandidatuppsatsen görs ofta åt en extern uppdragsgivare, och masteruppsatsen skrivs från januari till juni. Ni får en genomarbetad analys och en student som redan kan er data när det är dags att anställa.",
  },
  {
    kicker: "Sommarjobb",
    rubrik: "Någon som kan ta en egen analys",
    text: "Efter andra året har studenterna regression, prognoser, R, SAS och SQL och har drivit ett helt projekt i grupp. Ni får hjälp på riktigt, och ser vem ni vill ha kvar.",
  },
  {
    kicker: "Första jobbet",
    rubrik: "Rekrytera innan någon annan hinner",
    text: "Med examen tar de ett problem hela vägen, från fråga till resultat, och säger hur säkra slutsatserna är. Det samtalet kan börja på STAR.",
  },
];

const STEG = [
  { rubrik: "Ni anmäler intresse", text: "Några rader räcker, och ni kan också bara vilja veta mer." },
  { rubrik: "SASU hör av sig", text: "Vi berättar om upplägget och bokar ett möte med SASU eller styrelsen om ni vill prata vidare." },
  { rubrik: "Ni möter studenterna", text: "Som utställare, sponsor eller huvudsponsor. Vi sköter arrangemanget, ni kommer med det ni vill visa." },
];

export default async function StarInvitation(props: PageProps<"/star/inbjudan/[kod]">) {
  const [{ kod }, sp, code] = await Promise.all([props.params, props.searchParams, getStarInviteCode()]);
  if (!code || kod !== code) notFound();

  const [sasu, settings, kompetens, branscher] = await Promise.all([getCommitteeBySlug("sasu"), getSettings(), getBlock("kompetens"), getBlock("branscher")]);
  const [event, companies] = await Promise.all([getStarEvent(Number(settings.star_event_id) || null), starIsLive(settings) ? listStarCompanies({ activeOnly: true }) : []]);
  const contact = sasu?.email || settings.contact_email;
  const tack = sp.tack === "1" || sp.tack === "mote" ? sp.tack : null;
  const fel = (["fel", "fort", "full", "kod"] as const).find((k) => k === sp.fel) as IntresseFel | undefined;

  return (
    <div data-star-rot className="star-sky star-sida text-white">
      <StarHimmel />
      <StarRorelse />

      <StarHero subtitle={`Inbjudan till ${settings.star_subtitle || STAR_COPY.subtitle}`} withBar={false}>
        <div className="md:col-span-8">
          <p className="star-type max-w-3xl text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.1]">Era nästa statistiker sitter redan i Linköping</p>
          {event ? <EventFacts event={event} className="mt-4" /> : <p className="mono-accent mt-4 text-sm text-white/85 md:text-base">Datum kommer snart</p>}
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
            De kan regression, R och maskininlärning, och de letar efter någon att använda det hos. På STAR träffar ni dem öga mot öga, innan de har bestämt sig.
          </p>
        </div>
        <div className="md:col-span-4">
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a href="#anmal" className="btn btn-red">
              Anmäl intresse <ArrowRight size={18} />
            </a>
            <a href="#kompetens" className="btn btn-ghost-dark">
              Se vad de kan <ChevronDown size={18} />
            </a>
          </div>
        </div>
      </StarHero>

      <StudenternasKompetens natt innehall={kompetens} />

      <Branscher natt innehall={branscher} href="#anmal" />

      <section className="star-avsnitt relative py-16 md:py-24">
        <div className="container-site">
          <p data-star-in className="kicker text-white/70">
            Därför STAR
          </p>
          <h2 data-star-in className={`${H2} mt-3`}>
            Här är ni rätt
          </h2>
          <ul className="mt-10 md:mt-14">
            {SKAL.map((s) => (
              <li key={s.rubrik} data-star-in className="grid gap-3 border-t border-white/15 py-7 md:grid-cols-12 md:gap-8 md:py-9">
                <h3 className="star-type text-2xl font-light leading-tight md:col-span-5 md:text-[2rem]">{s.rubrik}</h3>
                <p className="max-w-2xl leading-relaxed text-white/90 md:col-span-7 md:text-lg">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="star-avsnitt relative py-16 md:py-24">
        <div className="container-site">
          <p data-star-in className="kicker text-white/70">
            Vad ni får med er
          </p>
          <h2 data-star-in className={`${H2} mt-3 max-w-4xl`}>
            En dag som lönar sig länge
          </h2>
          <ul className="mt-10 grid gap-3 md:grid-cols-3">
            {UTBYTE.map((u) => (
              <li key={u.kicker} data-star-in className="min-w-0 rounded-[1.5rem] border border-white/15 bg-white/[0.04] p-6 md:p-7">
                <p className="kicker text-white/70">{u.kicker}</p>
                <h3 className="star-type mt-4 text-2xl font-light leading-tight">{u.rubrik}</h3>
                <p className="mt-3 leading-relaxed text-white/90">{u.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="anmal" className="star-ankare relative pb-20 md:pb-28">
        <div data-star-in className="star-rod h-0.5 w-full" aria-hidden />
        <div className="container-site mt-14 grid gap-10 md:mt-20 lg:grid-cols-12 lg:gap-14">
          <div className="min-w-0 lg:col-span-5">
            <p className="kicker text-white/70">Intresseanmälan</p>
            <h2 className={`${H2} mt-3`}>Var med på STAR</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/90">Det tar två minuter och är inte bindande. Anmälan går direkt till SASU, som ansvarar för STAR.</p>
            <ol className="mt-8 space-y-5">
              {STEG.map((s, i) => (
                <li key={s.rubrik} className="flex gap-4">
                  <span aria-hidden className="mono-accent grid size-8 shrink-0 place-items-center rounded-full border border-white/30 text-sm tabular">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.rubrik}</h3>
                    <p className="mt-0.5 text-white/85">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            {companies.length > 0 && (
              <div className="mt-8">
                <p className="kicker text-white/70">Redan med</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {companies.map((c) => (
                    <li key={c.id} className="rounded-full border border-white/20 bg-white/[0.05] px-3.5 py-1.5 text-sm font-medium [overflow-wrap:anywhere]">
                      {c.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <a href={mailtoWithSubject(contact, "Vi vill veta mer om STAR")} className="mt-8 inline-flex items-center gap-2 font-semibold underline underline-offset-4 hover:text-white/80 [overflow-wrap:anywhere]">
              <Mail size={18} /> Hellre mejl? {contact}
            </a>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <div className="rounded-[1.75rem] border border-white/15 bg-white/[0.05] p-5 sm:p-6 md:p-8">
              {tack ? (
                <div role="status" className="py-4 md:py-8">
                  <span aria-hidden className="grid size-12 place-items-center rounded-full bg-white text-star-navy">
                    <Check size={24} />
                  </span>
                  <p className="star-type mt-6 text-[clamp(1.9rem,5vw,3rem)] font-light leading-[1.1]">Tack, nu har SASU er anmälan</p>
                  <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/90">
                    {tack === "mote" ? "Vi hör av oss så snart vi kan för att hitta en tid för mötet." : "Vi hör av oss så snart vi kan och berättar hur ni kan vara med."}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    {event && (
                      <a href={`/evenemang/${event.slug}/kalender.ics`} className="btn btn-light">
                        <Calendar size={18} /> Lägg dagen i kalendern
                      </a>
                    )}
                    <Link href="/foretag" className="btn btn-ghost-dark">
                      Mer om StatLin
                    </Link>
                  </div>
                </div>
              ) : (
                <IntresseForm kod={kod} serverFel={fel} />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
