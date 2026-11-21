import Link from "next/link";
import { NewsRow } from "@/components/content/news-card";
import { ArrowRight, Handshake } from "@/components/icons";
import { QuickLinksRow } from "@/components/links/quick-links";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getSettings, listCommittees } from "@/lib/data/content";
import { starIsLive } from "@/lib/naringsliv";
import { readDb } from "@/lib/data/db";
import { frageladaIsOpen } from "@/lib/data/fragelada";
import { listFeaturedLinks } from "@/lib/data/links";
import { listNews } from "@/lib/data/news";
import { getBlock } from "@/lib/innehall/server";
import { SITE_TEXTS, siteText, type SiteTextKey, type TextDef } from "@/lib/site-texts";
import { RText } from "@/components/edit-mode/redigerbar";
import { cn } from "@/lib/utils";
import { StartKort } from "./start-knappar";
import { UpcomingEvents } from "./upcoming-events";

/*
 * Startsidan under heron börjar med genvägarna som en smal rad. Sedan kommer tre band med samma luft och samma rubrikstil: vad som
 * händer (kalendern och nyheterna), utskotten och vem du är (ny student eller företag). Ett bands två delar står bredvid varandra där
 * bandet är minst 896 pixlar brett. Bredden mäts på bandet och inte på fönstret, eftersom bandet slutar växa vid sidans maxbredd.
 */
const BAND = "@container py-10 md:py-14";
const SPALTER = "container-site grid grid-cols-1 gap-x-12 @4xl:grid-cols-12";
// Rubriken och innehållet står på bandets två rader, så att innehållet börjar på samma höjd i båda spalterna även när en rubrik bryts.
const SPALT = "@4xl:row-span-2 @4xl:grid @4xl:grid-rows-subgrid @4xl:gap-y-0";
const KORT = "redigerbar-farg group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl p-5 text-white md:p-6";
// Rubrikerna är lika höga i båda korten (STAR har ett streck under sig), så att de står på samma linje och korten blir lika höga.
const KORT_RUBRIK = "text-[clamp(1.5rem,1rem_+_1vw,1.875rem)] leading-none";
// Texten och knappen står på samma rad där kortet är brett nog, annars knappen under texten. Texten börjar uppe och knappen står
// i nedre högra hörnet, så att två kort bredvid varandra linjerar även när det ena har mer text.
const KORT_INNE = "relative flex flex-1 flex-col";
const KORT_FOT = "mt-2 flex flex-1 flex-wrap items-end gap-x-6 gap-y-3 text-[0.92rem] leading-snug";
const KORT_TEXT = "max-w-md flex-1 basis-56 self-start";
const KORT_KNAPP = "ml-auto inline-flex shrink-0 items-center gap-2.5 font-semibold";
const KORT_PIL = "grid size-8 place-items-center rounded-full bg-white transition-transform duration-500 group-hover:translate-x-1";

export async function HomeSections() {
  const [news, committees, settings, start, links, db] = await Promise.all([listNews(4), listCommittees({ visibleOnly: true }), getSettings(), getBlock("start"), listFeaturedLinks(), readDb()]);
  const utskott = committees.filter((c) => c.kind !== "styrelse");
  // Frågelådan står sist bland genvägarna när den är öppen, så att den som fått en kod hittar var den ska skrivas.
  const fragelada = frageladaIsOpen(db);
  const genvagar = links.length > 0 || fragelada;
  // Rubrikerna och de små texterna ändras där de står i redigeringsläget, se site-texts.ts. Ett tomt fält ger standardtexten.
  const t = (key: SiteTextKey) => siteText(settings, key);
  // Utan accentstil får *ord* klassen contents, så att stjärnorna inte syns.
  const rtext = (key: SiteTextKey, className = "contents") => <RText id={`s:${key}`} value={t(key)} accent={className} rader={!!(SITE_TEXTS[key] as TextDef).long} />;
  const rubrik = (key: SiteTextKey) => rtext(key, "text-red");
  /** Bandens rubriker står i spalter, så länken står kvar på etikettens rad i alla bredder. */
  const spaltrubrik = (del: "evenemang" | "nytt" | "utskott", href: string) => (
    <Reveal>
      <SectionHeading stack kicker={rtext(`text_start_${del}_kicker`)} title={rubrik(`text_start_${del}_rubrik`)} href={href} linkLabel={rtext(`text_start_${del}_lank`)} />
    </Reveal>
  );

  return (
    <>
      {genvagar && <QuickLinksRow links={links} fragelada={fragelada} />}

      {/* Vad händer: kalendern, och de senaste nyheterna som rader bredvid. Utan nyheter får kalendern hela bredden. */}
      <section className={cn(BAND, "border-b border-line")}>
        <div className={cn(SPALTER, "gap-y-10")}>
          <div className={cn(SPALT, news.length ? "@4xl:col-span-7" : "@4xl:col-span-12")}>
            {spaltrubrik("evenemang", "/evenemang")}
            <UpcomingEvents />
          </div>
          {news.length > 0 && (
            <div className={cn(SPALT, "@4xl:col-span-5")}>
              {spaltrubrik("nytt", "/nyheter")}
              <ul className="mt-6 divide-y divide-line md:mt-7">
                {news.map((n) => (
                  <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                    <NewsRow item={n} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Utskotten: rubriken till vänster och loggorna till höger där bandet är brett nog, annars rubriken över loggorna. */}
      <section className={cn(BAND, "below-fold border-b border-line [--fold-h:280px]")}>
        <div className={cn(SPALTER, "gap-y-6 @4xl:items-center")}>
          <div className="@4xl:col-span-5">{spaltrubrik("utskott", "/utskott")}</div>
          {/* Fyra loggor per rad på telefon. Från 640 pixlar alla på en rad, hur många de än är. */}
          <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none @4xl:col-span-7">
            {utskott.map((c) => (
              <li key={c.id}>
                <Link href={`/utskott/${c.slug}`} className="group flex flex-col items-center gap-2.5 text-center">
                  {c.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logo_url}
                      alt={`${c.short_name}-loggan`}
                      width={160}
                      height={160}
                      loading="lazy"
                      className="size-14 object-contain drop-shadow-[0_10px_16px_rgba(20,20,19,0.16)] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:rotate-[-5deg]"
                    />
                  )}
                  <span className="display-tight text-[0.95rem] normal-case transition-colors group-hover:text-red-deep">{c.short_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Vem är du: två vägar in, för den som är ny och för företagen. */}
      <section className={cn(BAND, "below-fold [--fold-h:410px]")}>
        <div className="container-site grid grid-cols-1 gap-5 @4xl:grid-cols-2">
          <Reveal className="h-full">
            <StartKort start={start} vilket="ny" className={cn(KORT, "noise bg-red")}>
              <div className="grid-paper pointer-events-none absolute inset-0 text-white" aria-hidden />
              <span className="kicker relative text-white">{rtext("text_start_ny_kicker")}</span>
              <div className={KORT_INNE}>
                <h2 className={cn(KORT_RUBRIK, "display pb-2")}>{rtext("text_start_ny_rubrik")}</h2>
                <div className={KORT_FOT}>
                  <p className={cn(KORT_TEXT, "text-white/85")}>{rtext("text_start_ny_text", "text-white")}</p>
                  <span className={KORT_KNAPP}>
                    {rtext("text_start_ny_knapp")}
                    <span className={cn(KORT_PIL, "text-red")}>
                      <ArrowRight size={15} />
                    </span>
                  </span>
                </div>
              </div>
              {/* Vattenmärket står uppe till höger och tonar ut nedåt, så att det inte går igenom texten. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/statlin-vit.svg"
                loading="lazy"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-20 w-64 max-w-none opacity-[0.16] [mask-image:linear-gradient(to_bottom,#000_40%,transparent_80%)] transition-transform duration-[1.4s] ease-[var(--ease-out-expo)] group-hover:rotate-[-10deg] group-hover:scale-105"
              />
            </StartKort>
          </Reveal>
          <Reveal delay={120} className="h-full">
            <StartKort start={start} vilket="star" live={starIsLive(settings)} className={cn(KORT, "bg-star-navy")}>
              <StarField />
              <span className="kicker relative flex items-center gap-2 text-white/70">
                <Handshake size={16} /> {rtext("text_start_star_kicker")}
              </span>
              <div className={KORT_INNE}>
                {/* Strecket under är lika brett som ordet, som i STAR-loggan. */}
                <p className={cn(KORT_RUBRIK, "w-fit border-b-2 border-[#8f1d1d] pb-1.5 font-light uppercase tracking-[0.18em] [font-stretch:110%]")}>STAR</p>
                <div className={KORT_FOT}>
                  <p className={cn(KORT_TEXT, "text-white/80")}>{rtext("text_start_star_text", "text-white")}</p>
                  <span className={KORT_KNAPP}>
                    {rtext(starIsLive(settings) ? "text_start_star_knapp_live" : "text_start_star_knapp")}
                    <span className={cn(KORT_PIL, "text-star-navy")}>
                      <ArrowRight size={15} />
                    </span>
                  </span>
                </div>
              </div>
            </StartKort>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/**
 * Stjärnhimmel med en punkt-linje-graf, inspirerad av STAR-loggan.
 * Lägena är procent och radierna pixlar: med en viewBox som sträcks ut blir stjärnorna ovaler på breda ytor.
 */
export function StarField({ figureClassName }: { figureClassName?: string }) {
  const stars = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 137.5) % 100;
    const y = (i * 61.8 + (i % 7) * 13) % 100;
    return { x, y, r: ((i * 7) % 10) / 10 + 0.3, o: 0.25 + ((i * 13) % 10) / 14 };
  });
  // Grafen håller sig uppe till höger. Texten står längst ner till vänster, och en punkt mitt i en mening ser ut som ett skrivtecken.
  const constellation = [
    [58, 36],
    [64, 31],
    [69, 33],
    [75, 25],
    [81, 23],
    [87, 15],
    [92, 12],
  ];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="star-glow" cx="80%" cy="10%" r="80%">
          <stop offset="0" stopColor="#3d5bb8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0b1530" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#star-glow)" />
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r * 1.1} fill="#fff" opacity={s.o} />
      ))}
      <g className={figureClassName}>
        {constellation.slice(1).map(([x, y], i) => {
          const [fromX, fromY] = constellation[i];
          return <line key={i} x1={`${fromX}%`} y1={`${fromY}%`} x2={`${x}%`} y2={`${y}%`} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.75" />;
        })}
        {constellation.map(([x, y], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r="2.5" fill="#fff" />
        ))}
      </g>
    </svg>
  );
}
