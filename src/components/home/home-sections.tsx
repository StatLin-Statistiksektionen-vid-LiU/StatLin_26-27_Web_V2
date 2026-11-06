import Link from "next/link";
import { NewsCard } from "@/components/content/news-card";
import { ArrowRight, ArrowUpRight, Calendar, Handshake } from "@/components/icons";
import { QuickLinksRow } from "@/components/links/quick-links";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Editable } from "@/components/edit-mode/editable";
import { AccentText, stripAccent } from "@/components/ui/accent-text";
import { SectionHeading } from "@/components/ui/section-heading";
import { DEFAULT_SETTINGS, getSettings, listBoard, listCommittees } from "@/lib/data/content";
import { starIsLive } from "@/lib/naringsliv";
import { readDb } from "@/lib/data/db";
import { countUpcomingEvents } from "@/lib/data/events";
import { frageladaIsOpen } from "@/lib/data/fragelada";
import { listFeaturedLinks } from "@/lib/data/links";
import { listNews } from "@/lib/data/news";
import { PROGRAMS } from "@/lib/links";
import { siteText, type SiteTextKey } from "@/lib/site-texts";
import { UpcomingTimeline } from "./upcoming-timeline";

/** Raden med genvägar under heron. Frågelådan står sist när den är öppen, så att den som fått en kod hittar var den ska skrivas. */
export async function HomeShortcuts() {
  const [links, db] = await Promise.all([listFeaturedLinks(), readDb()]);
  return <QuickLinksRow links={links} fragelada={frageladaIsOpen(db)} />;
}

export async function HomeSections() {
  const [upcomingCount, news, committees, board, settings] = await Promise.all([
    countUpcomingEvents(),
    listNews(4),
    listCommittees({ visibleOnly: true }),
    listBoard(),
    getSettings(),
  ]);
  const utskott = committees.filter((c) => c.kind !== "styrelse");
  // Rubrikerna och de små texterna ändras med pennorna i redigeringsläget, se site-texts.ts. Ett tomt fält ger standardtexten.
  const t = (key: SiteTextKey) => siteText(settings, key);
  const plain = (key: SiteTextKey) => stripAccent(t(key));
  const accent = (key: SiteTextKey, className = "mono-accent text-red-deep") => <AccentText text={t(key)} accentClassName={className} />;
  const stats = [
    { value: utskott.length, label: plain("text_start_siffra_utskott"), note: utskott.length > 1 ? `från ${utskott[0].short_name} till ${utskott[utskott.length - 1].short_name}` : "på sektionen", href: "/utskott" },
    { value: board.length, label: plain("text_start_siffra_styrelsen"), note: "väljs varje år", href: "/sektionen/styrelsen" },
    { value: upcomingCount, label: plain("text_start_siffra_evenemang"), note: "just nu i kalendern", href: "/evenemang" },
    { value: PROGRAMS.length, label: plain("text_start_siffra_program"), note: PROGRAMS.map((p) => p.label.toLowerCase()).join(" och "), href: `/studenter/${PROGRAMS[0].value}` },
  ];

  return (
    <>
      {/* 01 Om */}
      <section id="utforska" className="relative overflow-hidden">
        <div className="grid-paper-fine pointer-events-none absolute inset-0 text-ink [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="container-site relative grid gap-12 py-20 md:py-28 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Editable target={{ type: "home" }} label="Redigera texten">
              <p className="kicker flex items-center gap-3 text-stone">
                <span className="text-red-deep">01</span>
                <span className="h-px w-8 bg-ink/20" aria-hidden />
                {plain("text_start_om_kicker")}
              </p>
              <p className="mt-7 text-[clamp(1.6rem,3vw,2.6rem)] font-semibold leading-[1.14] tracking-tight [font-stretch:104%]">
                <AccentText text={settings.home_intro.trim() || DEFAULT_SETTINGS.home_intro} accentClassName="mono-accent text-red-deep" />
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/sektionen" className="btn btn-ink group">
                  {plain("text_start_om_knapp")}
                  <ArrowRight size={18} className="transition-transform duration-500 group-hover:translate-x-1" />
                </Link>
                <Link href="/sektionen/styrelsen" className="btn btn-ghost">
                  {plain("text_start_om_knapp2")}
                </Link>
              </div>
            </Editable>
          </Reveal>

          <Reveal delay={150} className="lg:col-span-5">
            <Editable target={{ type: "home" }} label="Redigera siffrorna">
              <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-white">
                {stats.map((s, i) => (
                  <div
                    key={s.href}
                    className={`group/siffra relative p-6 transition-colors hover:bg-paper-2/50 md:p-7 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""} border-line`}
                  >
                    {/* Länken täcker hela rutan med after, eftersom en dl inte får ha något annat än dt och dd i sina grupper. */}
                    <dt className="kicker pr-6 text-stone">
                      <Link href={s.href} className="after:absolute after:inset-0">
                        {s.label}
                      </Link>
                      <ArrowUpRight size={15} className="absolute right-5 top-5 text-stone-light transition-[color,translate] duration-300 group-hover/siffra:-translate-y-0.5 group-hover/siffra:translate-x-0.5 group-hover/siffra:text-red" />
                    </dt>
                    <dd className="display mt-4 text-[clamp(2.3rem,4.2vw,3.3rem)] text-ink">
                      <CountUp value={s.value} />
                    </dd>
                    <dd className="mt-2 text-sm text-stone">{s.note}</dd>
                  </div>
                ))}
              </dl>
            </Editable>
          </Reveal>
        </div>
      </section>

      {/* 02 Evenemang. Tidslinjen går kant i kant genom delen och visar vad som är på gång, utan att ta över sidan. */}
      <section className="relative border-y border-line bg-paper-2/40 py-20 md:py-28">
        <div className="container-site">
          <Reveal>
            <Editable target={{ type: "texts", group: "start-evenemang" }} label="Redigera rubriken">
              <SectionHeading index="02" kicker={plain("text_start_evenemang_kicker")} title={accent("text_start_evenemang_rubrik")} href="/evenemang" linkLabel={plain("text_start_evenemang_lank")} />
            </Editable>
          </Reveal>
        </div>
        <div className="mt-12">
          <UpcomingTimeline />
        </div>
        <div className="container-site">
          <Reveal className="mt-10">
            <Editable target={{ type: "texts", group: "start-evenemang" }} label="Redigera rutan">
              <a
                href="/kalender.ics"
                className="group flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-ink/25 sm:flex-row sm:items-center"
              >
                <span className="flex items-center gap-4">
                  <span className="grid size-10 place-items-center rounded-lg bg-ink text-paper">
                    <Calendar size={18} />
                  </span>
                  <span>
                    <span className="block font-semibold">{accent("text_start_kalender_rubrik", "text-red-deep")}</span>
                    <span className="block text-sm text-stone">{accent("text_start_kalender_text", "text-red-deep")}</span>
                  </span>
                </span>
                <span className="kicker flex items-center gap-2 text-red-deep">
                  kalender.ics <ArrowUpRight size={14} />
                </span>
              </a>
            </Editable>
          </Reveal>
        </div>
      </section>

      {/* 03 Utskott */}
      <section className="below-fold relative overflow-hidden py-20 [--fold-h:1360px] md:py-28">
        <div className="grid-paper pointer-events-none absolute inset-0 text-ink [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="container-site relative">
          <Reveal>
            <Editable target={{ type: "texts", group: "start-utskott" }} label="Redigera rubriken">
              <SectionHeading index="03" kicker={plain("text_start_utskott_kicker")} title={accent("text_start_utskott_rubrik")} href="/utskott" linkLabel={plain("text_start_utskott_lank")} />
            </Editable>
          </Reveal>
          <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
            {utskott.map((c, i) => (
              <li key={c.id} className="bg-white">
                <Reveal delay={(i % 4) * 70} className="h-full">
                  <Link href={`/utskott/${c.slug}`} className="group relative flex h-full flex-col items-center px-5 pb-7 pt-9 text-center transition-colors duration-500 hover:bg-paper-2/60">
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
                        className="relative size-24 object-contain drop-shadow-[0_10px_16px_rgba(20,20,19,0.16)] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:rotate-[-5deg] group-hover:scale-105 md:size-28"
                      />
                    )}
                    <span className="display-tight relative mt-6 text-xl normal-case">{c.short_name}</span>
                    <span className="relative mt-2 line-clamp-4 text-sm leading-snug text-stone">{c.tagline}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
            {/* Fyller ut rutnätet och bjuder in till engagemang. Den som vill gå med väljer ett utskott och hör av sig till det. */}
            {utskott.length % 2 === 1 && (
              <li className="bg-white">
                <Editable target={{ type: "texts", group: "start-utskott" }} label="Redigera rutan" inset className="h-full">
                  <Link href="/utskott" className="group flex h-full flex-col items-center justify-center gap-4 px-5 py-10 text-center transition-colors hover:bg-paper-2/60">
                    <span className="grid size-14 place-items-center rounded-full border border-line text-2xl transition-[rotate,background-color,border-color,color] duration-500 group-hover:rotate-90 group-hover:border-red group-hover:bg-red group-hover:text-[#fff]">+</span>
                    <span className="display-tight text-xl">{accent("text_start_engagera_rubrik")}</span>
                    <span className="text-sm text-stone transition-colors group-hover:text-ink">{accent("text_start_engagera_text", "text-red-deep")}</span>
                  </Link>
                </Editable>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* 04 Nytt */}
      {news.length > 0 && (
        <section className="below-fold py-20 [--fold-h:2050px] md:py-28">
          <div className="container-site">
            <Reveal>
              <Editable target={{ type: "texts", group: "start-nytt" }} label="Redigera rubriken">
                <SectionHeading index="04" kicker={plain("text_start_nytt_kicker")} title={accent("text_start_nytt_rubrik")} href="/nyheter" linkLabel={plain("text_start_nytt_lank")} />
              </Editable>
            </Reveal>
            <Reveal className="mt-12">
              <NewsCard item={news[0]} featured />
            </Reveal>
            {news.length > 1 && (
              <div className="mt-14 grid gap-10 border-t border-line pt-12 md:grid-cols-3">
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

      {/* 05 Vägar in – luften ovanför kommer annars från nyheterna, som bara visas när det finns några. */}
      <section className={`below-fold [--fold-h:860px] ${news.length > 0 ? "pb-20 md:pb-28" : "py-20 md:py-28"}`}>
        {/* Ordet STUDENT? får inte alltid plats i kortet i rubrikens minsta storlek, så den rubriken krymper med kortets bredd och STAR med skärmen under 360 px. grid-cols-1 hindrar att innehållet gör kolumnen bredare än sidan. */}
        <div className="container-site grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal>
            <Editable target={{ type: "texts", group: "start-vagar" }} label="Redigera kortet">
              <Link href="/studenter/ny-student" className="noise group relative flex min-h-[23rem] flex-col justify-between overflow-hidden rounded-2xl bg-red p-8 text-white md:p-10">
                <div className="grid-paper pointer-events-none absolute inset-0 text-white" aria-hidden />
                <span className="kicker relative text-white">{plain("text_start_ny_kicker")}</span>
                <div className="@container relative">
                  <h2 className="display text-[min(clamp(2.4rem,5vw,4.4rem),13.5cqw)]">{accent("text_start_ny_rubrik", "mono-accent")}</h2>
                  <p className="mt-4 max-w-md text-lg text-white/85">
                    {accent("text_start_ny_text", "text-white")}
                  </p>
                  <span className="mt-8 inline-flex items-center gap-3 font-semibold">
                    {plain("text_start_ny_knapp")}
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
              </Link>
            </Editable>
          </Reveal>
          <Reveal delay={120}>
            <Editable target={{ type: "texts", group: "start-vagar" }} label="Redigera kortet">
              <Link href={starIsLive(settings) ? "/star" : "/foretag"} className="group relative flex min-h-[23rem] flex-col justify-between overflow-hidden rounded-2xl bg-star-navy p-8 text-white md:p-10">
                <StarField />
                <span className="kicker relative flex items-center gap-2 text-white/70">
                  <Handshake size={16} /> {plain("text_start_star_kicker")}
                </span>
                <div className="relative">
                  <p className="text-[clamp(2.4rem,5vw,4.4rem)] font-light uppercase leading-none tracking-[0.18em] [font-stretch:110%] max-[22.5rem]:text-[10vw]">STAR</p>
                  <div className="mt-2 h-[3px] w-40 bg-[#8f1d1d]" aria-hidden />
                  <p className="mt-5 max-w-md text-lg text-white/80">
                    {accent("text_start_star_text", "text-white")}
                  </p>
                  <span className="mt-8 inline-flex items-center gap-3 font-semibold">
                    {plain(starIsLive(settings) ? "text_start_star_knapp_live" : "text_start_star_knapp")}
                    <span className="grid size-10 place-items-center rounded-full bg-white text-star-navy transition-transform duration-500 group-hover:translate-x-1.5">
                      <ArrowRight size={18} />
                    </span>
                  </span>
                </div>
              </Link>
            </Editable>
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
