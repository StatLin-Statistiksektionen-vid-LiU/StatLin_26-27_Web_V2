import Link from "next/link";
import { NewsCard } from "@/components/content/news-card";
import { ArrowRight, ArrowUpRight, Calendar, Handshake } from "@/components/icons";
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
import { StartKort } from "./start-knappar";
import { UpcomingTimeline } from "./upcoming-timeline";

/** Raden med genvägar under kalendern. Frågelådan står sist när den är öppen, så att den som fått en kod hittar var den ska skrivas. */
export async function HomeShortcuts() {
  const [links, db] = await Promise.all([listFeaturedLinks(), readDb()]);
  return <QuickLinksRow links={links} fragelada={frageladaIsOpen(db)} />;
}

export async function HomeSections() {
  const [news, committees, settings, start] = await Promise.all([listNews(4), listCommittees({ visibleOnly: true }), getSettings(), getBlock("start")]);
  const utskott = committees.filter((c) => c.kind !== "styrelse");
  // Rubrikerna och de små texterna ändras där de står i redigeringsläget, se site-texts.ts. Ett tomt fält ger standardtexten.
  const t = (key: SiteTextKey) => siteText(settings, key);
  // Utan accentstil får *ord* klassen contents, så att stjärnorna inte syns.
  const rtext = (key: SiteTextKey, className = "contents") => <RText id={`s:${key}`} value={t(key)} accent={className} rader={!!(SITE_TEXTS[key] as TextDef).long} />;
  const rubrik = (key: SiteTextKey) => rtext(key, "mono-accent text-red-deep");

  return (
    <>
      {/* 01 Evenemang, direkt under heron. Tidslinjen går kant i kant genom delen och visar vad som är på gång. */}
      <section className="relative border-b border-line bg-paper-2/40 py-10 md:py-14">
        <div className="container-site">
          <Reveal>
            <SectionHeading index="01" kicker={rtext("text_start_evenemang_kicker")} title={rubrik("text_start_evenemang_rubrik")} href="/evenemang" linkLabel={rtext("text_start_evenemang_lank")} />
          </Reveal>
        </div>
        <div className="mt-7 md:mt-8">
          <UpcomingTimeline />
        </div>
        <div className="container-site">
          <Reveal className="mt-7">
            <a
              href="/kalender.ics"
              className="group flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-white px-5 py-3.5 transition-colors hover:border-ink/25 sm:flex-row sm:items-center"
            >
              <span className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink text-paper">
                  <Calendar size={18} />
                </span>
                <span>
                  <span className="block font-semibold">{rtext("text_start_kalender_rubrik", "text-red-deep")}</span>
                  <span className="block text-sm text-stone">{rtext("text_start_kalender_text", "text-red-deep")}</span>
                </span>
              </span>
              <span className="kicker flex items-center gap-2 text-red-deep">
                kalender.ics <ArrowUpRight size={14} />
              </span>
            </a>
          </Reveal>
        </div>
      </section>

      <HomeShortcuts />

      {/* 02 Utskott */}
      <section className="below-fold relative overflow-hidden py-12 [--fold-h:1250px] md:py-16">
        <div className="container-site relative">
          <Reveal>
            <SectionHeading index="02" kicker={rtext("text_start_utskott_kicker")} title={rubrik("text_start_utskott_rubrik")} href="/utskott" linkLabel={rtext("text_start_utskott_lank")} />
          </Reveal>
          <ul className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
            {utskott.map((c, i) => (
              <li key={c.id} className="bg-white">
                <Reveal delay={(i % 4) * 70} className="h-full">
                  <Link href={`/utskott/${c.slug}`} className="group relative flex h-full flex-col items-center px-5 pb-6 pt-7 text-center transition-colors duration-500 hover:bg-paper-2/60">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                      style={{ background: `radial-gradient(circle at 50% 35%, ${c.accent}30, transparent 65%)` }}
                    />
                    {c.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.logo_url}
                        alt={`${c.short_name}-loggan`}
                        width={160}
                        height={160}
                        loading="lazy"
                        className="relative size-20 object-contain drop-shadow-[0_10px_16px_rgba(20,20,19,0.16)] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:rotate-[-5deg] group-hover:scale-105 md:size-24"
                      />
                    )}
                    <span className="display-tight relative mt-5 text-xl normal-case">{c.short_name}</span>
                    <span className="relative mt-1.5 line-clamp-4 text-sm leading-snug text-stone">{c.tagline}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
            {/* Fyller ut rutnätet och bjuder in till engagemang. Den som vill gå med väljer ett utskott och hör av sig till det. */}
            {utskott.length % 2 === 1 && (
              <li className="bg-white">
                <Link href="/utskott" className="group flex h-full flex-col items-center justify-center gap-3.5 px-5 py-8 text-center transition-colors hover:bg-paper-2/60">
                  <span className="grid size-14 place-items-center rounded-full border border-line text-2xl transition-[rotate,background-color,border-color,color] duration-500 group-hover:rotate-90 group-hover:border-red group-hover:bg-red group-hover:text-[#fff]">+</span>
                  <span className="display-tight text-xl">{rubrik("text_start_engagera_rubrik")}</span>
                  <span className="text-sm text-stone transition-colors group-hover:text-ink">{rtext("text_start_engagera_text", "text-red-deep")}</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* 03 Nytt */}
      {news.length > 0 && (
        <section className="below-fold pb-12 [--fold-h:1900px] md:pb-16">
          <div className="container-site">
            <Reveal>
              <SectionHeading index="03" kicker={rtext("text_start_nytt_kicker")} title={rubrik("text_start_nytt_rubrik")} href="/nyheter" linkLabel={rtext("text_start_nytt_lank")} />
            </Reveal>
            <Reveal className="mt-8">
              <NewsCard item={news[0]} featured />
            </Reveal>
            {news.length > 1 && (
              <div className="mt-10 grid gap-10 border-t border-line pt-8 md:grid-cols-3">
                {news.slice(1, 4).map((n, i) => (
                  <Reveal key={n.id} delay={i * 90}>
                    <NewsCard item={n} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 04 Vägar in. Luften ovanför kommer från utskotten eller nyheterna. */}
      <section className="below-fold pb-12 [--fold-h:860px] md:pb-16">
        {/* Ordet STUDENT? får inte alltid plats i kortet i rubrikens minsta storlek, så den rubriken krymper med kortets bredd och STAR med skärmen under 360 px. grid-cols-1 hindrar att innehållet gör kolumnen bredare än sidan. */}
        <div className="container-site grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <StartKort start={start} vilket="ny" className="redigerbar-farg noise group relative flex h-full min-h-[23rem] flex-col justify-between overflow-hidden rounded-2xl bg-red p-8 text-white md:p-10">
              <div className="grid-paper pointer-events-none absolute inset-0 text-white" aria-hidden />
              <span className="kicker relative text-white">{rtext("text_start_ny_kicker")}</span>
              <div className="@container relative">
                <h2 className="display text-[min(clamp(2.4rem,5vw,4.4rem),13.5cqw)]">{rtext("text_start_ny_rubrik", "mono-accent")}</h2>
                <p className="mt-4 max-w-md text-lg text-white/85">{rtext("text_start_ny_text", "text-white")}</p>
                <span className="mt-8 inline-flex items-center gap-3 font-semibold">
                  {rtext("text_start_ny_knapp")}
                  <span className="grid size-10 place-items-center rounded-full bg-white text-red transition-transform duration-500 group-hover:translate-x-1.5">
                    <ArrowRight size={18} />
                  </span>
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/statlin-vit.svg"
                loading="lazy"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -right-24 w-[26rem] max-w-none opacity-20 transition-transform duration-[1.4s] ease-[var(--ease-out-expo)] group-hover:rotate-[-10deg] group-hover:scale-105"
              />
            </StartKort>
          </Reveal>
          <Reveal delay={120} className="h-full">
            <StartKort start={start} vilket="star" live={starIsLive(settings)} className="redigerbar-farg group relative flex h-full min-h-[23rem] flex-col justify-between overflow-hidden rounded-2xl bg-star-navy p-8 text-white md:p-10">
              <StarField />
              <span className="kicker relative flex items-center gap-2 text-white/70">
                <Handshake size={16} /> {rtext("text_start_star_kicker")}
              </span>
              <div className="relative">
                <p className="text-[clamp(2.4rem,5vw,4.4rem)] font-light uppercase leading-none tracking-[0.18em] [font-stretch:110%] max-[22.5rem]:text-[10vw]">STAR</p>
                <div className="mt-2 h-[3px] w-40 bg-[#8f1d1d]" aria-hidden />
                <p className="mt-5 max-w-md text-lg text-white/80">{rtext("text_start_star_text", "text-white")}</p>
                <span className="mt-8 inline-flex items-center gap-3 font-semibold">
                  {rtext(starIsLive(settings) ? "text_start_star_knapp_live" : "text_start_star_knapp")}
                  <span className="grid size-10 place-items-center rounded-full bg-white text-star-navy transition-transform duration-500 group-hover:translate-x-1.5">
                    <ArrowRight size={18} />
                  </span>
                </span>
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
