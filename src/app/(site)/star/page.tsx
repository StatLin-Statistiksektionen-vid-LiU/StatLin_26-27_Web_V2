import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { setStarLive } from "@/app/admin/_actions/naringsliv";
import { SmartImage } from "@/components/content/smart-image";
import { Editable } from "@/components/edit-mode/editable";
import { ArrowRight, ArrowUpRight, Calendar, ChevronDown, Edit, Eye, Mail } from "@/components/icons";
import { EventFacts, StarHero, type EventFactsData } from "@/components/star/star-hero";
import { StarHimmel } from "@/components/star/star-himmel";
import { EmptySky, StarMap } from "@/components/star/star-map";
import { StarRorelse } from "@/components/star/star-rorelse";
import "@/components/star/star.css";
import { getSessionUser } from "@/lib/auth/session";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { getStarEvent } from "@/lib/data/events";
import { canManageNaringsliv, listStarCompanies } from "@/lib/data/naringsliv";
import { COMPANY_ROLE_LABELS, countdownText, mailtoWithSubject, parseProgram, parseSeeks, parseStarFaq, parseStarTips, SEEK_KINDS, SEEK_LABELS, starIsLive, type ProgramStop, type StarCompany } from "@/lib/naringsliv";
import { STAR_COPY } from "@/lib/seed-content";
import { cn, safeExternalUrl } from "@/lib/utils";

/** Så länge sidan är dold ska sökmotorerna inte hitta den, och beskrivningen får inte lova något som inte syns. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  if (!starIsLive(settings)) return { title: "STAR kommer snart", description: settings.star_teaser, robots: { index: false, follow: false } };
  return {
    title: "STAR, arbetsmarknadsdagen",
    description: "STAR är StatLins arbetsmarknadsdag i Linköping. Se vilka företag som kommer, vad de söker och hur dagen ser ut.",
  };
}

// Företagen, kartan och filtret fungerar utan JavaScript, så sidan renderas hel vid varje anrop i stället för med ett skelett.
export const instant = false;

const H2 = "star-type text-[clamp(2.4rem,6vw,4.5rem)] font-light uppercase leading-none tracking-[0.08em]";
export default async function StarPage(props: PageProps<"/star">) {
  const [companies, sasu, settings, user, sp] = await Promise.all([listStarCompanies({ activeOnly: true }), getCommitteeBySlug("sasu"), getSettings(), getSessionUser(), props.searchParams]);
  const event = await getStarEvent(Number(settings.star_event_id) || null);
  // Samma mottagare som anmälningarna från inbjudan, så att ett företag aldrig får två olika adresser.
  const contact = sasu?.email || settings.contact_email;
  const companyMail = mailtoWithSubject(contact, "Vi vill vara med på STAR");
  const live = starIsLive(settings);
  const owner = !!user && !user.must_change_password && canManageNaringsliv(user);
  // Den som får ändra sidan kan se den som en besökare, annars går det inte att veta hur den dolda sidan ser ut.
  const asVisitor = owner && sp.som === "besokare";
  const canEdit = owner && !asVisitor;

  if (!live && !canEdit) {
    return (
      <div data-star-rot className="star-sky star-sida text-white">
        <StarHimmel />
        <StarRorelse />
        {asVisitor && <OwnerBar live={live} asVisitor />}
        <StarHero subtitle={settings.star_subtitle || STAR_COPY.subtitle} withBar={asVisitor}>
          <div className="md:col-span-7">
            <h2 className="star-type text-[clamp(2rem,5vw,3.5rem)] font-light leading-tight">STAR-sidan kommer snart</h2>
            {event && <EventFacts event={event} className="mt-4" />}
            {settings.star_teaser && <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">{settings.star_teaser}</p>}
          </div>
          <div className="md:col-span-5">
            <div className="flex flex-wrap gap-3 md:justify-end">
              <a href={companyMail} className="btn btn-light">
                <Mail size={18} /> Vill ni vara med?
              </a>
              <Link href="/foretag" className="btn btn-ghost-dark">
                Fler sätt att samarbeta
              </Link>
            </div>
          </div>
        </StarHero>
      </div>
    );
  }

  const program = event ? parseProgram(event.body_md) : [];
  const mainSponsors = companies.filter((c) => c.role === "huvudsponsor");
  const sponsors = companies.filter((c) => c.role === "sponsor");
  const hasSponsors = mainSponsors.length > 0 || sponsors.length > 0;
  const tips = parseStarTips(settings.star_tips);
  const faq = parseStarFaq(settings.star_faq);
  const sections = [
    { href: "#vilka-kommer", label: "Vilka kommer" },
    ...(event ? [{ href: "#dagen", label: "Dagen" }] : []),
    ...(hasSponsors ? [{ href: "#sponsorer", label: "Sponsorer" }] : []),
    ...(tips.length > 0 ? [{ href: "#forbered-dig", label: "Förbered dig" }] : []),
    ...(faq.length > 0 ? [{ href: "#fragor", label: "Frågor" }] : []),
    { href: "#vara-med", label: "Vara med" },
  ];

  return (
    <div data-star-rot className="star-sky star-sida text-white">
      <StarHimmel />
      <StarRorelse />
      {(canEdit || asVisitor) && <OwnerBar live={live} asVisitor={asVisitor} />}
      {/* Heron är loggan i sidans storlek: bokstäverna, den röda linjen genom dem och grafen uppför himlen. */}
      <StarHero subtitle={settings.star_subtitle || STAR_COPY.subtitle} withBar={canEdit || asVisitor}>
        <div className="md:col-span-7">
          {event ? <CountdownFacts event={event} /> : <p className="star-type text-[clamp(2rem,5vw,3.5rem)] font-light leading-tight">Datum kommer snart</p>}
          <Pen on={canEdit} label="Ändra sidans texter" className="mt-5 max-w-xl">
            {settings.star_intro && <p className="text-lg leading-relaxed text-white/90">{settings.star_intro}</p>}
          </Pen>
        </div>
        <div className="md:col-span-5">
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a href="#vilka-kommer" className="btn btn-light">
              Vilka kommer <ChevronDown size={18} />
            </a>
            {event && (
              <a href={`/evenemang/${event.slug}/kalender.ics`} className="btn btn-ghost-dark">
                <Calendar size={18} /> Lägg i kalendern
              </a>
            )}
          </div>
          {companies.length > 0 && (
            <p className="kicker mt-6 text-white/65 md:text-right">
              <span className="text-white tabular">{companies.length}</span> företag på plats
            </p>
          )}
          {mainSponsors.length > 0 && (
            <p className="kicker mt-2 text-white/65 md:text-right">
              Huvudsponsor <span className="text-white">{mainSponsors.map((s) => s.name).join(", ")}</span>
            </p>
          )}
        </div>
      </StarHero>

      <SectionNav items={sections} />

      <section id="vilka-kommer" className="star-scope star-avsnitt relative isolate py-16 md:py-24">
        <div className="container-site">
          <h2 data-star-in className={H2}>Vilka kommer</h2>
          {companies.length === 0 ? (
            <div className="relative mt-10">
              <EmptySky />
              <div className="mt-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="star-type text-2xl md:text-3xl">Företagen presenteras snart</p>
                  <p className="mt-2 max-w-lg text-white/85">Stjärnorna tänds en efter en i takt med att företagen bekräftar. Titta in igen längre fram.</p>
                </div>
                <a href={companyMail} className="btn btn-ghost-dark shrink-0">
                  <Mail size={18} /> Vill ni vara med?
                </a>
              </div>
            </div>
          ) : (
            <>
              <Pen on={canEdit} label="Ändra sidans texter" className="mt-5 max-w-2xl">
                {settings.star_companies_intro && <p className="text-lg text-white/90">{settings.star_companies_intro}</p>}
              </Pen>
              <SeekFilter companies={companies} />
              <div className="mt-8">
                <StarMap companies={companies} />
              </div>
              <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {companies.map((c, i) => (
                  <CompanyCard key={c.id} company={c} delay={(i % 3) * 70} />
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {event && (
        <section id="dagen" className="star-avsnitt py-16 md:py-24">
          <div className="container-site">
            {/* Banan klättrar från nedre vänstra hörnet, så att uppgifterna om dagen får plats i himlen ovanför den. */}
            <div className="relative z-10 lg:max-w-[18rem]">
              <h2 data-star-in className={H2}>Dagen</h2>
              <EventFacts event={event} stacked className="mt-6" />
              <p className="mt-5">
                <Link href={`/evenemang/${event.slug}`} className="tryck link-underline inline-flex items-center gap-1.5 text-sm font-semibold">
                  Mer om dagen <ArrowRight size={15} />
                </Link>
              </p>
            </div>
            {program.length > 0 ? <Route stops={program} /> : <p className="mt-8 max-w-xl text-lg text-white/85">Programmet kommer snart.</p>}
          </div>
        </section>
      )}

      {hasSponsors && (
        <section id="sponsorer" className="star-avsnitt py-16 md:py-24">
          <div className="container-site">
            <h2 data-star-in className={H2}>Sponsorer</h2>
            <Pen on={canEdit} label="Ändra sidans texter" className="mt-5 max-w-xl">
              {settings.star_sponsors_intro && <p className="text-lg text-white/90">{settings.star_sponsors_intro}</p>}
            </Pen>
            {mainSponsors.map((s) => (
              <MainSponsor key={s.id} company={s} />
            ))}
            {sponsors.length > 0 && (
              <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {sponsors.map((s) => (
                  <li key={s.id} data-star-in="stor">
                    <SponsorPlate company={s} className="h-24 md:h-28" imageClass="max-h-14" textClass="text-lg" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tips.length > 0 && (
        <section id="forbered-dig" className="star-avsnitt py-16 md:py-24">
          <div className="container-site grid gap-10 lg:grid-cols-12">
            <h2 data-star-in className={cn(H2, "lg:col-span-5")}>Förbered dig</h2>
            <Pen on={canEdit} label="Ändra sidans texter" className="lg:col-span-7">
              <ol className="star-route star-tips" data-long="">
                {tips.map((tip, i) => (
                  <li key={`${i}-${tip}`} data-star-in="stor" className="star-stop">
                    <p className="text-lg leading-snug text-white/90">{tip}</p>
                  </li>
                ))}
              </ol>
            </Pen>
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section id="fragor" className="star-avsnitt py-16 md:py-24">
          <div className="container-site grid gap-10 lg:grid-cols-12">
            <h2 data-star-in className={cn(H2, "lg:col-span-5")}>Frågor</h2>
            <Pen on={canEdit} label="Ändra sidans texter" className="lg:col-span-7">
              <div className="star-faq">
                {faq.map((f, i) => (
                  <details key={`${i}-${f.question}`}>
                    <summary>{f.question}</summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
              </div>
            </Pen>
          </div>
        </section>
      )}

      {/* Två vägar ut, under den röda linjen som bär hela sidan. */}
      <section id="vara-med" className="star-ankare pb-20 md:pb-28">
        <div data-star-in className="star-rod h-0.5 w-full" aria-hidden />
        <div className="container-site mt-14 grid gap-10 md:mt-20 md:grid-cols-2 md:gap-16">
          <div>
            <p className="kicker text-white/65">För dig som student</p>
            <Pen on={canEdit} label="Ändra sidans texter" className="mt-4">
              {settings.star_student_title && <p className="star-type text-3xl font-light leading-tight md:text-4xl">{settings.star_student_title}</p>}
              {settings.star_student_text && <p className="mt-4 max-w-md text-white/90">{settings.star_student_text}</p>}
            </Pen>
            <div className="mt-7 flex flex-wrap gap-3">
              {event && (
                <Link href={`/evenemang/${event.slug}`} className="btn btn-light">
                  Om evenemanget <ArrowRight size={18} />
                </Link>
              )}
              <Link href="/lunchforelasningar" className="btn btn-ghost-dark">
                Lunchföreläsningar
              </Link>
            </div>
          </div>
          <div>
            <p className="kicker text-white/65">För er som företag</p>
            <Pen on={canEdit} label="Ändra sidans texter" className="mt-4">
              {settings.star_company_title && <p className="star-type text-3xl font-light leading-tight md:text-4xl">{settings.star_company_title}</p>}
              {settings.star_company_text && <p className="mt-4 max-w-md text-white/90">{settings.star_company_text}</p>}
            </Pen>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={companyMail} className="btn btn-red">
                <Mail size={18} /> {contact}
              </a>
              <Link href="/foretag" className="btn btn-ghost-dark">
                Fler sätt att samarbeta
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Pennan syns bara för den som får ändra sidan. Alla texter öppnar samma formulär, och besökare får bara texten. */
function Pen({ on, label, className, children }: { on: boolean; label: string; className?: string; children: ReactNode }) {
  if (on) {
    return (
      <Editable target={{ type: "star" }} label={label} className={className}>
        {children}
      </Editable>
    );
  }
  return <div className={className}>{children}</div>;
}

/** Raden överst för den som får ändra sidan: läget, knappen som ändrar det och vägen till formulären. Sidhuvudet ligger ovanpå. */
function OwnerBar({ live, asVisitor = false }: { live: boolean; asVisitor?: boolean }) {
  return (
    <div className={cn("relative z-10 pt-[var(--header-h)] text-white", live ? "bg-white/[0.08]" : "bg-[#8f1d1d]")}>
      <div className="container-site flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <p className="text-sm font-semibold">{asVisitor ? "Du ser sidan som en besökare." : live ? "Sidan är live och syns för alla." : "Förhandsvisning: besökare ser bara att STAR kommer snart."}</p>
        <div className="flex flex-wrap items-center gap-2">
          {asVisitor ? (
            <a href="/star" className="btn btn-light btn-sm">
              Tillbaka till redigeringen
            </a>
          ) : (
            <>
              <form action={setStarLive}>
                <input type="hidden" name="live" value={live ? "0" : "1"} />
                <button type="submit" className={live ? "btn btn-ghost-dark btn-sm" : "btn btn-light btn-sm"}>
                  {live ? "Dölj sidan" : "Gör sidan live"}
                </button>
              </form>
              <Link href="/admin/star" className="btn btn-ghost-dark btn-sm">
                <Edit size={15} /> Redigera i admin
              </Link>
              <a href="/star?som=besokare" className="btn btn-ghost-dark btn-sm">
                <Eye size={15} /> Se som besökare
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Genvägarna längs sidan. Vanliga ankarlänkar, så att de fungerar utan JavaScript, och raden stannar kvar under sidhuvudet. */
function SectionNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="På den här sidan" className="star-nav">
      <ul className="container-site">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Grafen från loggan, över ordet STAR. Den följer ordets ruta och inte heron, så att den går genom bokstäverna på alla skärmar och
 * aldrig över texten under. Linjen töjs med rutan, så punkterna är egna element: en töjd SVG-cirkel blir en ellips.
 */
function CountdownFacts({ event }: { event: EventFactsData }) {
  const countdown = countdownText(event.starts_at);
  return (
    <>
      <p className="star-type text-[clamp(2rem,5vw,3.5rem)] font-light leading-tight first-letter:uppercase">{countdown ?? "Pågår nu"}</p>
      <EventFacts event={event} className="mt-4" />
    </>
  );
}

/** Filtret är radioknappar som star.css läser med :has. Bara det någon faktiskt söker går att välja, så att urvalet aldrig blir tomt. */
function SeekFilter({ companies }: { companies: StarCompany[] }) {
  const counts = SEEK_KINDS.map((kind) => ({ kind, count: companies.filter((c) => parseSeeks(c.seeks).includes(kind)).length })).filter((k) => k.count > 0);
  if (counts.length === 0) return null;
  const chip = "flex h-10 pointer-coarse:h-11 cursor-pointer items-center gap-2 rounded-full border border-white/30 px-4 font-mono text-[0.72rem] uppercase tracking-[0.08em] transition-colors hover:border-white";
  return (
    <fieldset className="star-filter mt-7">
      <legend className="sr-only">Visa företag som söker</legend>
      <div className="flex flex-wrap gap-2">
        <label>
          <input type="radio" name="soker" value="alla" defaultChecked className="peer sr-only" />
          <span className={chip}>Alla {companies.length}</span>
        </label>
        {counts.map(({ kind, count }) => (
          <label key={kind}>
            <input type="radio" name="soker" id={`soker-${kind}`} value={kind} className="peer sr-only" />
            <span className={chip}>
              {SEEK_LABELS[kind]} {count}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CompanyCard({ company, delay }: { company: StarCompany; delay: number }) {
  const url = safeExternalUrl(company.url);
  const seeks = parseSeeks(company.seeks);
  return (
    <li id={`foretag-${company.id}`} data-seeks={company.seeks} data-star-in="stor" style={{ "--d": `${delay}ms` } as React.CSSProperties} className="star-card @container flex flex-col rounded-[1.5rem] border border-white/15 bg-white/[0.04] p-6">
      {/* I ett smalt kort står namnet under loggan, annars bryts långa namn mitt i ordet. */}
      <div className="flex flex-col items-start gap-3 @xs:flex-row @xs:items-center @xs:gap-4">
        <span className={cn("grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-xl p-2.5", company.logo ? "bg-white" : "border border-white/25")}>
          {company.logo ? (
            <SmartImage image={company.logo} contain sizes="128px" className="h-full w-full" alt="" />
          ) : (
            <span className="star-type text-2xl font-light uppercase tracking-[0.1em]" aria-hidden>
              {company.name.slice(0, 2)}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <h3 className="star-type text-xl leading-tight [overflow-wrap:anywhere]">{company.name}</h3>
          {company.role !== "utstallare" && <p className="kicker mt-1 text-white/70">{COMPANY_ROLE_LABELS[company.role]}</p>}
        </div>
      </div>
      {company.description && <p className="mt-4 text-[0.95rem] leading-relaxed text-white/90">{company.description}</p>}
      {seeks.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-1.5">
          <span className="sr-only">Söker: </span>
          {seeks.map((k) => (
            <span key={k} className="chip border border-white/30 text-white/90">
              {SEEK_LABELS[k]}
            </span>
          ))}
        </p>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="tryck link-underline mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-semibold">
          Till webbplatsen <ArrowUpRight size={15} />
          <span className="sr-only"> för {company.name} (öppnas i ny flik)</span>
        </a>
      )}
    </li>
  );
}

/** Programmet som en bana uppför himlen. Stegen ligger där grafen i loggan går: uppåt åt höger, med ett hack varannan punkt. */
function Route({ stops }: { stops: ProgramStop[] }) {
  // Fler än sex punkter får inte plats bredvid varandra, och då blir banan en vanlig lista även på datorn.
  const long = stops.length > 6;
  const n = stops.length;
  const points = stops.map((_, i) => {
    const x = n === 1 ? 0 : (i / n) * 100;
    const climb = n === 1 ? 0 : (i / (n - 1)) * 62;
    const notch = i % 2 === 1 ? -12 : 0;
    return { x, y: Math.max(2, 68 - climb + notch + 2) };
  });
  return (
    <ol className="star-route mt-12" data-long={long ? "" : undefined}>
      <svg className="star-route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {stops.map((s, i) => (
        <li key={`${s.time}-${i}`} data-star-in="stor" className="star-stop" style={{ "--x": points[i].x, "--y": points[i].y, "--w": `${100 / n}%`, "--d": `${Math.min(i, 5) * 60}ms` } as React.CSSProperties}>
          <p className="star-type text-3xl font-light tabular">{s.time}</p>
          <p className="mt-1 text-white/85">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

function SponsorPlate({ company, className, imageClass, textClass }: { company: StarCompany; className: string; imageClass: string; textClass: string }) {
  const url = safeExternalUrl(company.url);
  const inner = company.logo ? (
    <SmartImage image={company.logo} contain sizes="320px" className={`h-full max-w-[80%] ${imageClass}`} alt={company.name} />
  ) : (
    <span className={`star-type px-3 text-center text-star-navy [overflow-wrap:anywhere] ${textClass}`}>{company.name}</span>
  );
  const plate = `grid w-full place-items-center overflow-hidden rounded-[1.25rem] bg-white p-4 ${className}`;
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${plate} transition-transform duration-500 hover:-translate-y-1`} aria-label={`${company.name} (öppnas i ny flik)`}>
      {inner}
    </a>
  ) : (
    <div className={plate}>{inner}</div>
  );
}

function MainSponsor({ company }: { company: StarCompany }) {
  return (
    <div data-star-in="stor" className="mt-10 grid items-center gap-8 md:grid-cols-12">
      <div className="md:col-span-5">
        <SponsorPlate company={company} className="h-40 md:h-48" imageClass="max-h-24 md:max-h-32" textClass="text-3xl md:text-5xl font-light uppercase tracking-[0.08em]" />
      </div>
      <div className="md:col-span-7">
        <p className="kicker text-white/65">Huvudsponsor</p>
        <p className="star-type mt-3 text-3xl leading-tight">{company.name}</p>
        {company.description && <p className="mt-3 max-w-md leading-relaxed text-white/90">{company.description}</p>}
      </div>
    </div>
  );
}
