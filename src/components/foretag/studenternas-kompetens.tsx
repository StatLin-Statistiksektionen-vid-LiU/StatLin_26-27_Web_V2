"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";
import { FARDIGHETER, FORSTA_NIVA, GULDKORN, LAGE_TEXT, NIVAER, PROGRAM, type KompetensLage } from "@/lib/foretag-kompetens";
import { cn } from "@/lib/utils";

/** Det som ingår lyser vitt, resten är genomskinliga bubblor. */
const CHIP_NATT: Record<KompetensLage, string> = {
  j: "border-white bg-white text-ink",
  v: "border-white/50 bg-white/10 text-white",
  n: "border-white/15 text-white/70",
};
/** Dagens sida: det som ingår är fyllt med textfärgen, resten är ljusa och tomma bubblor. */
const CHIP_DAG: Record<KompetensLage, string> = {
  j: "border-ink bg-ink text-paper",
  v: "border-ink/40 bg-paper-2 text-ink",
  n: "border-line bg-white text-stone",
};

const ALLA = FARDIGHETER.flatMap((g) => g.rader);
/** Tänder färdigheterna en i taget, i den ordning de står. */
const FORDROJNING = new Map(ALLA.map((rad, i) => [rad.namn, i * 14]));
const SISTA = NIVAER.length - 1;

/** Fylld, halvfylld och tom, så att läget inte bara hänger på färgen. */
function Markering({ lage }: { lage: KompetensLage }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full border border-current",
        lage === "j" && "bg-current",
        lage === "v" && "bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]",
      )}
    />
  );
}

function arNy(lagen: string, niva: number) {
  return niva > 0 && lagen[niva] !== "n" && lagen[niva - 1] === "n";
}

/**
 * Studenterna som företagen möter: de två programmen, och vad en student kan efter varje steg. Väljaren följer med när man scrollar, så att
 * man kan bläddra och se färdigheterna tändas samtidigt. När den först kommer i bild går den igenom stegen en gång, tills besökaren tar över.
 * Natt är STAR-inbjudans utseende, samma innehåll på natthimlen.
 */
export function StudenternasKompetens({ natt = false }: { natt?: boolean }) {
  const [niva, setNiva] = useState(FORSTA_NIVA);
  const tagitOver = useRef(false);
  const ankare = useRef<HTMLDivElement>(null);
  const valjare = useRef<HTMLDivElement>(null);
  const svep = useRef<{ x: number; y: number } | null>(null);
  const vakt = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);

  const valj = (i: number) => {
    tagitOver.current = true;
    setNiva(Math.max(0, Math.min(SISTA, i)));
  };

  useEffect(() => {
    const el = valjare.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let vantar = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (tagitOver.current) return io.disconnect();
        if (!vantar) {
          // Bara om väljaren ligger nedanför skärmen: den som redan ser den ska inte få innehållet utbytt framför sig.
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) return io.disconnect();
          vantar = true;
          setNiva(0);
          return;
        }
        if (!entry.isIntersecting) return;
        io.disconnect();
        const nasta = (i: number) => {
          if (tagitOver.current) return;
          setNiva(i);
          if (i < SISTA) timer = setTimeout(() => nasta(i + 1), 1150);
        };
        timer = setTimeout(() => nasta(1), 800);
      },
      { rootMargin: "0px 0px -30% 0px", threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Vakten ligger så långt ovanför väljaren som sidhuvudet tar plats. När den har lämnat skärmen uppåt sitter väljaren fast.
  useEffect(() => {
    const el = vakt.current;
    const b = band.current;
    if (!el || !b) return;
    const io = new IntersectionObserver(([entry]) => {
      b.toggleAttribute("data-fast", !entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const visa = (i: number) => {
    valj(i);
    const lugn = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ankare.current?.scrollIntoView({ block: "start", behavior: lugn ? "auto" : "smooth" });
  };

  const namn = natt ? "kompetens-niva-natt" : "kompetens-niva";
  const h2 = natt ? "star-type text-[clamp(1.9rem,5vw,3.5rem)] font-light uppercase leading-[1.05] tracking-[0.06em]" : "display-tight text-3xl md:text-5xl";
  const ingarForAlla = ALLA.filter((r) => r.lagen[niva] === "j").length;
  const efterVal = ALLA.filter((r) => r.lagen[niva] === "v").length;
  const kan = ingarForAlla + efterVal;
  const nya = ALLA.filter((r) => arNy(r.lagen, niva)).length;

  return (
    <section id="kompetens" className={cn("overflow-x-clip", natt ? "star-avsnitt relative py-16 text-white md:py-24" : "border-b border-line pb-20 pt-14 text-ink md:pb-28 md:pt-20")}>
      <div className="container-site">
        <Reveal>
          <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>Två program vid Linköpings universitet</p>
          <h2 className={cn("mt-3", h2)}>
            <span className="block">De bygger modellen.</span> <span className="block">Och de vet när den har fel.</span>
          </h2>
          <p className={cn("mt-5 max-w-2xl text-lg leading-relaxed", natt ? "text-white/85" : "text-stone")}>
            Det är skillnaden mellan någon som kör kod och någon ni kan lämna en fråga till. Studenterna läser statistik på djupet, programmerar i R, Python och SQL och tränar på att förklara resultatet för den som ska fatta beslutet.
          </p>
        </Reveal>

        <ul className="mt-8 grid gap-3 md:mt-12 md:grid-cols-2">
          {PROGRAM.map((p, i) => (
            <Reveal key={p.namn} as="li" delay={i * 80} className={cn("flex min-w-0 flex-col rounded-2xl border p-6 md:p-8", natt ? "border-white/15 bg-white/[0.04]" : "border-line bg-white")}>
              <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>{p.typ}</p>
              <h3 className={cn("mt-3", natt ? "star-type text-2xl font-light md:text-3xl" : "display-tight text-2xl normal-case md:text-3xl")}>{p.namn}</h3>
              <p className="mt-5 text-lg font-semibold leading-snug md:text-xl">{p.roll}</p>
              <p className={cn("mt-3 leading-relaxed", natt ? "text-white/85" : "text-stone")}>{p.text}</p>
              <ul className="mb-6 mt-5 flex flex-1 flex-wrap content-start gap-1.5">
                {p.nyckelord.map((ord) => (
                  <li key={ord} className={cn("rounded-full border px-3 py-1 text-sm font-medium", natt ? "border-white/20 bg-white/[0.05]" : "border-line bg-white")}>
                    {ord}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => visa(NIVAER.findIndex((n) => n.id === p.niva))} className="btn btn-ghost-dark btn-sm self-start">
                Se vad de kan <ChevronDown size={15} />
              </button>
            </Reveal>
          ))}
        </ul>

        <div ref={ankare} className="mt-14 md:mt-20">
          <h2 className={natt ? "star-type text-3xl font-light md:text-4xl" : "display-tight text-2xl md:text-4xl"}>Vad våra studenter kan</h2>
          <p className={cn("mt-3 max-w-2xl text-lg leading-relaxed", natt ? "text-white/85" : "text-stone")}>Kurserna ändras över åren, men färdigheterna består. Bläddra genom utbildningen och se vad studenten kan efter varje steg.</p>
        </div>

        {/* Väljaren och innehållet ligger i samma behållare, annars har väljaren inget att följa med i. */}
        <div className="relative mt-6 md:mt-8">
          <div ref={vakt} aria-hidden className="pointer-events-none absolute inset-x-0 top-[calc(-1*(var(--header-h)+0.5rem))] h-px" />
          <div ref={valjare} className="sticky top-[calc(var(--header-h)+0.5rem)] z-30 [@media(max-height:520px)]:static">
            {/* Det som scrollar förbi tonas bort här, annars sticker det fram vid väljarens rundade hörn och i glipan under sidhuvudet. Himlen är inte enfärgad, så bandet går över hela bredden och syns bara när väljaren sitter fast. */}
            <div
              ref={band}
              aria-hidden
              className={cn(
                "pointer-events-none absolute -bottom-5 -top-2 left-1/2 w-screen -translate-x-1/2 opacity-0 transition-opacity duration-200 data-[fast]:opacity-100 motion-reduce:transition-none [@media(max-height:520px)]:hidden",
                natt ? "bg-[linear-gradient(to_bottom,var(--color-star-navy)_calc(100%-1.25rem),transparent)]" : "bg-[linear-gradient(to_bottom,var(--color-paper)_calc(100%-1.25rem),transparent)]",
              )}
            />
            <fieldset className="relative">
              <legend className="sr-only">Bläddra genom utbildningen: visa vad en student kan på varje nivå</legend>
              <div className={cn("relative grid grid-cols-4 rounded-full border p-1", natt ? "border-white/20 bg-star-navy shadow-[0_10px_30px_rgb(0_0_0_/_0.35)]" : "border-line bg-white")}>
                <span
                  aria-hidden
                  className={cn("absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full transition-transform duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none", natt ? "bg-white" : "bg-ink")}
                  style={{ transform: `translateX(${niva * 100}%)` }}
                />
                {NIVAER.map((n, i) => (
                  <label
                    key={n.id}
                    className={cn("group relative flex min-h-11 cursor-pointer select-none flex-col items-center justify-center rounded-full px-1 py-1.5 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 md:min-h-14", natt ? "has-[:focus-visible]:outline-white" : "has-[:focus-visible]:outline-ink")}
                  >
                    {/* onClick också: ett klick på steget som redan visas ger ingen change, men ska ändå stoppa genomgången. */}
                    <input type="radio" name={namn} value={n.id} checked={i === niva} onChange={() => valj(i)} onClick={() => valj(i)} className="sr-only" />
                    <span className={cn("text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none md:text-base", i === niva ? (natt ? "text-ink" : "text-paper") : natt ? "text-white/85 group-hover:text-white" : "text-stone group-hover:text-ink")}>{n.etikett}</span>
                    <span className={cn("hidden text-xs transition-colors duration-200 motion-reduce:transition-none md:block", i === niva ? (natt ? "text-ink/70" : "text-paper/70") : natt ? "text-white/70" : "text-stone")}>{n.undertitel}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p aria-live="polite" className="sr-only">
            {NIVAER[niva].rubrik}: {kan} av {ALLA.length} färdigheter
          </p>

          <div
            className="mt-8 grid gap-10 [touch-action:pan-y_pinch-zoom] md:mt-10 lg:grid-cols-12 lg:gap-14"
            onPointerDown={(e) => {
              if (e.pointerType === "touch") svep.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerCancel={() => {
              svep.current = null;
            }}
            onPointerUp={(e) => {
              const start = svep.current;
              svep.current = null;
              if (!start) return;
              const dx = e.clientX - start.x;
              // Ett svep åt sidan bläddrar, men bara om det tydligt inte var ett försök att scrolla.
              if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 1.5) valj(niva + (dx < 0 ? 1 : -1));
            }}
          >
            <div className="min-w-0 lg:col-span-5">
              {/* Alla texter ligger i samma ruta, så att höjden är densamma och inget hoppar när man byter nivå. */}
              <div className="grid">
                {NIVAER.map((n, i) => (
                  <div
                    key={n.id}
                    data-niva={n.id}
                    className={cn("min-w-0 [grid-area:1/1] transition-[opacity,visibility] duration-300 motion-reduce:transition-none", i === niva ? "visible opacity-100" : "invisible opacity-0")}
                  >
                    <h3 className={natt ? "star-type text-3xl font-light" : "display-tight text-2xl md:text-3xl"}>{n.rubrik}</h3>
                    <p className={cn("mt-4 leading-relaxed", natt ? "text-white/90" : "text-ink")}>{n.text}</p>
                    <p className={cn("kicker mt-6", natt ? "text-white/70" : "text-stone")}>Ett uppdrag de klarar</p>
                    <p className="mt-2 text-lg font-semibold leading-snug">{n.uppdrag}</p>
                    <p className={cn("kicker mt-6", natt ? "text-white/70" : "text-stone")}>Passar för</p>
                    <p className={cn("mt-2 leading-snug", natt ? "text-white/90" : "text-ink")}>{n.passar}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => valj(niva - 1)}
                  aria-label={niva > 0 ? `Föregående steg: ${NIVAER[niva - 1].etikett}` : undefined}
                  className={cn("btn btn-ghost-dark btn-sm", niva === 0 && "invisible")}
                >
                  <ArrowLeft size={15} /> {niva > 0 ? NIVAER[niva - 1].etikett : NIVAER[0].etikett}
                </button>
                <button
                  type="button"
                  onClick={() => valj(niva + 1)}
                  aria-label={niva < SISTA ? `Nästa steg: ${NIVAER[niva + 1].etikett}` : undefined}
                  className={cn("btn btn-ghost-dark btn-sm", niva === SISTA && "invisible")}
                >
                  {niva < SISTA ? NIVAER[niva + 1].etikett : NIVAER[SISTA].etikett} <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-7">
              <div className="mb-7">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={cn("tabular text-4xl leading-none md:text-5xl", natt ? "star-type font-light" : "display-tight")}>{kan}</span>
                  <span className="font-semibold">av {ALLA.length} färdigheter</span>
                  {/* Finns kvar osynlig på första steget, så att raden tar lika stor plats och inget hoppar på smala skärmar. */}
                  <span className={cn("w-full sm:w-auto", natt ? "text-white/75" : "text-stone", nya === 0 && "invisible")} aria-hidden={nya === 0 || undefined}>
                    {nya === 1 ? "1 ny" : `${nya} nya`} sedan {NIVAER[Math.max(0, niva - 1)].etikett}
                  </span>
                </p>
                <div aria-hidden className="mt-3 flex gap-1">
                  {ALLA.map((rad, i) => (
                    <span
                      key={rad.namn}
                      style={{ transitionDelay: `${i * 14}ms` }}
                      className={cn("h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none pointer-coarse:transition-none", i < ingarForAlla ? "bg-red" : i < kan ? "bg-red/50" : natt ? "bg-white/15" : "bg-ink/10")}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {FARDIGHETER.map((grupp) => (
                  <div key={grupp.grupp}>
                    <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>{grupp.grupp}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {grupp.rader.map((rad) => {
                        const lage = rad.lagen[niva] as KompetensLage;
                        const ny = arNy(rad.lagen, niva);
                        return (
                          <li
                            key={rad.namn}
                            data-lage={lage}
                            data-ny={ny || undefined}
                            style={{ transitionDelay: `${FORDROJNING.get(rad.namn) ?? 0}ms` }}
                            className={cn(
                              // Färger kan inte tonas av grafikkortet. På telefonen byter bubblorna läge direkt, så att huvudtråden inte räknar om dem i varje bildruta.
                              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-300 motion-reduce:transition-none pointer-coarse:transition-none",
                              (natt ? CHIP_NATT : CHIP_DAG)[lage],
                              ny && "shadow-[0_0_0_2px_var(--color-red)]",
                            )}
                          >
                            <Markering lage={lage} />
                            {rad.namn}
                            <span className="sr-only">
                              : {LAGE_TEXT[lage].toLowerCase()}
                              {ny && ", ny på den här nivån"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              <ul className={cn("mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm", natt ? "border-white/15 text-white/75" : "border-line text-stone")}>
                {(["j", "v", "n"] as const).map((lage) => (
                  <li key={lage} className="inline-flex items-center gap-2">
                    <Markering lage={lage} />
                    {LAGE_TEXT[lage]}
                  </li>
                ))}
                <li className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-red" />
                  Nytt i det här steget
                </li>
              </ul>
              <p className={cn("mt-3 text-sm leading-relaxed", natt ? "text-white/75" : "text-stone")}>
                Sammanställt ur kursplanerna för LiU:s kandidatprogram i statistik och dataanalys och masterprogram i statistik och maskininlärning. Masterprogrammet går på engelska, och studenterna kommer från statistik, matematik, datavetenskap eller teknik.
              </p>
            </div>
          </div>
        </div>

        {/* Ligger utanför väljarens behållare, så att väljaren inte följer med hit. */}
        <div className="mt-16 md:mt-24">
          <Reveal>
            <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>Ur utbildnings- och kursplanerna</p>
            <h2 className={cn("mt-3", natt ? "star-type text-3xl font-light md:text-4xl" : "display-tight text-2xl md:text-4xl")}>Det som sällan står i ett CV</h2>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-3">
            {GULDKORN.map((g, i) => (
              <Reveal key={g.rubrik} as="li" delay={(i % 3) * 60} className={cn("flex min-w-0 flex-col rounded-2xl border p-6", natt ? "border-white/15 bg-white/[0.04]" : "border-line bg-white")}>
                <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>{g.kalla}</p>
                <h3 className="mt-3 text-lg font-semibold leading-snug md:text-xl">{g.rubrik}</h3>
                <p className={cn("mt-2 leading-relaxed", natt ? "text-white/85" : "text-stone")}>{g.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
