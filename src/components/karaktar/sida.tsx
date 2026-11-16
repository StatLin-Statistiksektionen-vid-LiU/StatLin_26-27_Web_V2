import Link from "next/link";
import type { ReactNode } from "react";
import { SmartImage } from "@/components/content/smart-image";
import { ArrowUpRight } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";
import type { CommitteeImage } from "@/lib/data/events";
import { formatDate } from "@/lib/dates";
import type { MotivNamn } from "@/lib/karaktar";
import { cn } from "@/lib/utils";

/*
 * Det som bär utskottets karaktär nedför sidan, under emblemet: skiljelinjerna i motivets formspråk, bilderna från utskottets evenemang och SCB:s mästeristass. Allt ritas i textens färg med utskottets färg (--motiv)
 * på det som är dess eget, som motiven runt loggan.
 */

/* Skiljelinjernas mönster: bredden på en upprepning och det som ritas i den, på höjden 28. */
const LINJER: Partial<Record<MotivNamn, [bredd: number, monster: ReactNode]>> = {
  // Mittlinjen med mittcirkeln.
  plan: [
    260,
    <>
      <path d="M0 14H260" />
      <circle cx="130" cy="14" r="9" fill="var(--color-paper)" />
      <circle cx="130" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </>,
  ],
  // Nätverket: en streckad tråd med en nod då och då, var tredje i utskottets färg.
  skiva: [
    216,
    <>
      <path d="M0 14H216" strokeDasharray="4 5" />
      {[36, 108, 180].map((x, i) => (
        <circle key={x} cx={x} cy="14" r="4" fill="var(--color-paper)" stroke={i === 1 ? "var(--motiv)" : undefined} strokeWidth={i === 1 ? 1.5 : undefined} />
      ))}
    </>,
  ],
  // Vimpelraden.
  vimplar: [
    66,
    <>
      <path d="M0 5Q16.5 9 33 5T66 5" />
      <path d="M4 6.6l13 .9-7.6 13z" fill="var(--motiv)" stroke="none" />
      <path d="M26 6.8l13-1-5.4 13.6z" fill="#f2c200" stroke="none" />
      <path d="M48 5.6l13 1.6-7.6 12.6z" />
    </>,
  ],
  // Skummet på ölen, med ett par bubblor på väg upp.
  bubblor: [
    84,
    <>
      <path d="M0 12a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0" />
      <circle cx="20" cy="22" r="2.25" stroke="var(--motiv)" />
      <circle cx="61" cy="19" r="1.5" stroke="var(--motiv)" />
    </>,
  ],
  // Stapelns kant, med en bit i utskottets färg.
  block: [
    144,
    <>
      <path d="M0 22H24V14H40V22H64V6H72V14H88V22H112V14H120V22H144" />
      <path d="M64 6h8v8h-8zM72 14h8v8h-8zM64 14h8v8h-8z" fill="var(--motiv)" fillOpacity={0.85} />
    </>,
  ],
  // Linjalen: ett streck per minut, längre var femte och kvarten i utskottets färg.
  urtavla: [
    90,
    <>
      <path d="M9 12v6M15 12v6M21 12v6M27 12v6M39 12v6M45 12v6M51 12v6M57 12v6M69 12v6M75 12v6M81 12v6M87 12v6" strokeWidth={1} />
      <path d="M33 9v9M63 9v9" />
      <path d="M3 5v13" stroke="var(--motiv)" strokeWidth={2} />
    </>,
  ],
  // En gren med blad.
  trad: [
    96,
    <>
      <path d="M0 15C16 9 32 21 48 15S80 9 96 15" />
      <path d="M22 12.5c1-5 4.5-7.5 9-7.5-1 5-4.5 7.5-9 7.5zM70 17.5c1 5 4.5 7.5 9 7.5-1-5-4.5-7.5-9-7.5z" fill="var(--motiv)" fillOpacity={0.3} stroke="var(--motiv)" />
    </>,
  ],
};

/** Skiljelinjen mellan sidans delar, i motivets formspråk. Utan eget motiv är den ett vanligt streck. */
export function Skiljare({ motiv, className }: { motiv?: MotivNamn; className?: string }) {
  const linje = motiv && LINJER[motiv];
  if (!linje) return <hr className={cn("border-line", className)} />;
  const [bredd, monster] = linje;
  return (
    <svg aria-hidden height="28" className={cn("block w-full text-ink/30", className)}>
      <defs>
        <pattern id={`skiljare-${motiv}`} width={bredd} height="28" patternUnits="userSpaceOnUse" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
          {monster}
        </pattern>
      </defs>
      <rect width="100%" height="28" fill={`url(#skiljare-${motiv})`} />
    </svg>
  );
}

/** Rubriken över en del av sidan: en liten etikett och det stora ordet. */
export function Delrubrik({ etikett, children, className }: { etikett: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="kicker text-red-deep">{etikett}</p>
      <h2 className="display-tight mt-3 text-[clamp(1.4rem,7vw,1.9rem)] [overflow-wrap:anywhere] md:text-[clamp(1.9rem,4vw,3.25rem)]">{children}</h2>
    </div>
  );
}

const LUTNING = ["-rotate-2", "rotate-[1.5deg]", "-rotate-1", "rotate-2", "-rotate-[1.5deg]", "rotate-1"];

/** Bilderna från utskottets evenemang, uppsatta som foton på en vägg. Varje bild går till sitt evenemangs album. */
export function Bildvagg({ bilder, namn }: { bilder: CommitteeImage[]; namn: string }) {
  // Väggen ska sluta med en hel rad: tre i bredd på stor skärm, två på telefon. Det som blir över på sista raden visas inte där.
  const antal = bilder.length;
  const over = (i: number) => cn(antal > 3 && i >= antal - (antal % 3) && "md:hidden", antal > 1 && antal % 2 === 1 && i === antal - 1 && "max-md:hidden");
  return (
    <section className="py-16 md:py-24">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Delrubrik etikett={`Bilder från ${namn}`}>Ur albumet</Delrubrik>
          <Link href="/galleri" className="link-underline inline-flex items-center gap-1.5 font-semibold">
            Hela galleriet <ArrowUpRight size={16} />
          </Link>
        </div>
        <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 md:gap-x-8 md:gap-y-12">
          {bilder.map((b, i) => (
            <Reveal as="li" key={b.id} delay={(i % 3) * 90} className={over(i)}>
              <Link href={`/evenemang/${b.event.slug}#galleri`} className={cn("foto group", LUTNING[i % LUTNING.length])}>
                <span className="foto-tejp" aria-hidden />
                <SmartImage image={b.image} sizes="(min-width: 768px) 30vw, 46vw" className="aspect-[4/3] w-full" alt={b.image.alt || b.caption || `Bild från ${b.event.title}`} />
                <span className="mt-3 block px-1 pb-1">
                  <span className="block truncate text-[0.95rem] font-bold tracking-tight">{b.event.title}</span>
                  <span className="kicker mt-0.5 block text-[0.62rem] text-stone">{formatDate(b.event.starts_at, true)}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Mästeristassens tre plagg, som platta ritningar. Svart och rött är deras egna färger, så korten är ljusa i båda lägena. */
const PLAGG: { namn: string; text: string; bild: ReactNode }[] = [
  {
    namn: "Hängselbyxor",
    text: "Svarta, med röda uppslag.",
    bild: (
      <>
        <path d="M46 34L44 8M74 34L76 8" stroke="#161616" strokeWidth={6} strokeLinecap="round" />
        <path d="M43 32H77L82 64H38Z" fill="#161616" />
        <path d="M37 62H83L88 128H64L60 88L56 128H32Z" fill="#161616" />
        <path d="M31.4 126H56.4V139H30.6ZM63.6 126H88.6L89.4 139H63.6Z" fill="var(--motiv)" />
        <path d="M52 41H68V53H52ZM40 70q6 9 14 9M80 70q-6 9-14 9" fill="none" stroke="#4a4a4a" strokeWidth={1.25} strokeLinecap="round" />
        <circle cx="46" cy="35" r="2.4" fill="#e9e4d8" />
        <circle cx="74" cy="35" r="2.4" fill="#e9e4d8" />
      </>
    ),
  },
  {
    namn: "Fluga",
    text: "Röd.",
    bild: (
      <>
        <path d="M56 75L22 52q-7 23 0 46zM64 75l34-23q7 23 0 46z" fill="var(--motiv)" />
        <path d="M30 62q10 8 22 11M30 88q10-8 22-11M90 62q-10 8-22 11M90 88q-10-8-22-11" fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={1.5} strokeLinecap="round" />
        <rect x="52" y="64" width="16" height="22" rx="5" fill="var(--motiv)" />
        <rect x="52" y="64" width="16" height="22" rx="5" fill="#000" fillOpacity={0.25} />
      </>
    ),
  },
  {
    namn: "Strumpor",
    text: "Röd-svart-randiga.",
    bild: (
      <>
        <clipPath id="strumpa">
          <path d="M38 12H64V84q0 8 8 12l16 8q9 6 5 16t-17 8l-26-6q-10-4-10-16z" />
        </clipPath>
        <g clipPath="url(#strumpa)">
          <rect x="30" width="70" height="140" fill="#161616" />
          {[22, 46, 70, 94, 118].map((y) => (
            <rect key={y} x="30" y={y} width="70" height="12" fill="var(--motiv)" />
          ))}
        </g>
        <path d="M38 12H64" stroke="#161616" strokeWidth={5} strokeLinecap="round" />
      </>
    ),
  },
];

/** SCB:s mästeristass: plaggen de känns igen på, och XCB som de gamla kallas. Texten kommer ur utskottets egen beskrivning. */
export function Stassen() {
  return (
    <section className="container-site pb-16 md:pb-24">
      <Delrubrik etikett="Så känner du igen oss">Mästeristassen</Delrubrik>
      <ul className="mt-10 grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        {PLAGG.map((p, i) => (
          <Reveal as="li" key={p.namn} delay={i * 90} className="plagg tema-fast">
            <svg viewBox="0 0 120 150" aria-hidden className="mx-auto h-40 w-auto md:h-48">
              {p.bild}
            </svg>
            <p className="kicker mt-4 text-[0.62rem] text-stone">Plagg {String(i + 1).padStart(2, "0")}</p>
            <p className="mt-1 text-lg font-bold tracking-tight">{p.namn}</p>
            <p className="mt-0.5 text-[0.92rem] text-stone">{p.text}</p>
          </Reveal>
        ))}
        <Reveal as="li" delay={270} className="plagg tema-fast">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/utskott/xcb.webp" alt="XCB:s märke" width={472} height={416} loading="lazy" className="mx-auto h-40 w-auto object-contain mix-blend-multiply md:h-48" />
          <p className="kicker mt-4 text-[0.62rem] text-stone">Efter mästeriet</p>
          <p className="mt-1 text-lg font-bold tracking-tight">XCB</p>
          <p className="mt-0.5 text-[0.92rem] text-stone">Så kallas gamla mästerimedlemmar.</p>
        </Reveal>
      </ul>
    </section>
  );
}
