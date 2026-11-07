"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { RFalt, RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { ArrowLeft, ArrowRight, ChevronDown } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";
import { FORSTA_NIVA, NIVA_ID, type KompetensLage } from "@/lib/foretag-kompetens";
import type { Kompetens } from "@/lib/innehall/typer";
import { cn } from "@/lib/utils";

type Program = Kompetens["program"][number];
type Niva = Kompetens["nivaer"][number];
type Grupp = Kompetens["grupper"][number];
type Fardighet = Grupp["fardigheter"][number];
/** En färdighet i redigeringsrutan, med gruppen den står i, så att den kan flyttas till en annan grupp. */
type FardighetRad = Fardighet & { grupp: string };
type Guldkorn = Kompetens["guldkorn"][number];
/** Blockets texter, de som inte hör till en rad i en lista. */
type TextNyckel = { [K in keyof Kompetens]: Kompetens[K] extends string ? K : never }[keyof Kompetens];

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

const SISTA = NIVA_ID.length - 1;
const MAX_FARDIGHETER = 40;

const GRUPP_FALT: Falt<Grupp>[] = [
  { nyckel: "namn", etikett: "Gruppens namn", max: 40, kravs: true, hjalp: "Tar du bort gruppen försvinner färdigheterna i den också." },
];

const GULDKORN_FALT: Falt<Guldkorn>[] = [
  { nyckel: "rubrik", etikett: "Rubriken", max: 100, kravs: true },
  { nyckel: "kalla", etikett: "Raden ovanför", max: 40, hjalp: "Var det står, till exempel Kandidat eller Båda programmen." },
  { nyckel: "text", etikett: "Texten", typ: "lang", max: 400 },
];

const stegen = (nivaer: Niva[]) => nivaer.map((n, i) => ({ varde: NIVA_ID[i], etikett: n.etikett }));

function programFalt(nivaer: Niva[]): Falt<Program>[] {
  return [
    { nyckel: "namn", etikett: "Programmets namn", max: 80, kravs: true },
    { nyckel: "typ", etikett: "Raden ovanför", max: 60, hjalp: "Till exempel Kandidatprogram, 3 år." },
    { nyckel: "roll", etikett: "Rollen", max: 120 },
    { nyckel: "text", etikett: "Texten", typ: "lang", max: 700 },
    { nyckel: "nyckelord", etikett: "Nyckelord", typ: "lista", antal: 16, max: 40, hjalp: "Med komma emellan, högst 16." },
    { nyckel: "niva", etikett: "Knappen visar steget", typ: "val", alternativ: stegen(nivaer) },
  ];
}

function fardighetFalt(k: Kompetens): Falt<FardighetRad>[] {
  const falt: Falt<FardighetRad>[] = [
    { nyckel: "namn", etikett: "Färdigheten", max: 60, kravs: true },
    { nyckel: "lagen", etikett: "Läget på varje steg", typ: "lagen", alternativ: stegen(k.nivaer) },
  ];
  if (k.grupper.length > 1) falt.push({ nyckel: "grupp", etikett: "Gruppen", typ: "val", alternativ: k.grupper.map((g, i) => ({ varde: String(i), etikett: g.namn })) });
  return falt;
}

/** Färdigheterna i en grupp efter en ändring. En färdighet som fått en annan grupp hamnar sist i den, om den har plats. */
function lagraFardigheter(k: Kompetens, gi: number, rader: FardighetRad[]) {
  const kvar: Fardighet[] = [];
  for (const { grupp, ...f } of rader) {
    const mal = k.grupper[Number(grupp)];
    if (Number(grupp) !== gi && mal && mal.fardigheter.length < MAX_FARDIGHETER) mal.fardigheter.push(f);
    else kvar.push(f);
  }
  k.grupper[gi].fardigheter = kvar;
}

/** En rad per stycke i rubriken. Mellanslaget mellan raderna gör att den läses och kopieras som en mening. */
const radvis = (t: string) =>
  t.split("\n").map((rad, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="block">{rad}</span>
    </Fragment>
  ));

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
 * Studenterna som företagen möter: programmen, och vad en student kan efter varje steg. Väljaren följer med när man scrollar, så att
 * man kan bläddra och se färdigheterna tändas samtidigt. När den först kommer i bild går den igenom stegen en gång, tills besökaren tar över.
 * Natt är STAR-inbjudans utseende, samma innehåll på natthimlen. Innehållet är blocket kompetens (src/lib/innehall/block/kompetens.ts):
 * texterna ändras där de står och listorna går att ändra, flytta, fylla på och tömma i redigeringsläget.
 */
export function StudenternasKompetens({ natt = false, innehall }: { natt?: boolean; innehall: Kompetens }) {
  const { varde: k, aktiv, andra } = useBlock("b:kompetens", innehall);
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

  // I redigeringsläget går väljaren inte igenom stegen själv: texten man skriver i ska inte bytas ut.
  useEffect(() => {
    if (aktiv) tagitOver.current = true;
  }, [aktiv]);

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

  /** En av blockets texter. format kan ge en egen visning, och aktiv när texten bara ska gå att ändra där den syns. */
  const text = (nyckel: TextNyckel, etikett: string, max: number, format: { kravs?: boolean; rader?: boolean; visa?: (t: string) => ReactNode; aktiv?: boolean } = {}) => (
    <RFalt
      aktiv={aktiv}
      varde={k[nyckel]}
      onCommit={(t) =>
        andra((x) => {
          x[nyckel] = t;
        })
      }
      etikett={etikett}
      max={max}
      {...format}
    />
  );
  /** En text i ett av stegen. Bara steget som visas går att ändra. */
  const nivaText = (i: number, nyckel: keyof Niva, etikett: string, max: number, kravs?: boolean) => (
    <RFalt
      aktiv={aktiv && i === niva}
      varde={k.nivaer[i][nyckel]}
      onCommit={(t) =>
        andra((x) => {
          x.nivaer[i][nyckel] = t;
        })
      }
      etikett={etikett}
      max={max}
      kravs={kravs}
    />
  );

  const namn = natt ? "kompetens-niva-natt" : "kompetens-niva";
  const h2 = natt ? "star-type text-[clamp(1.9rem,5vw,3.5rem)] font-light uppercase leading-[1.05] tracking-[0.06em]" : "display-tight text-3xl md:text-5xl";
  const svag = natt ? "text-white/70" : "text-stone";
  const alla = k.grupper.flatMap((g) => g.fardigheter);
  // Där varje grupp börjar bland alla färdigheter, så att de tänds en i taget i den ordning de står.
  const borjan = k.grupper.map((_, gi) => k.grupper.slice(0, gi).reduce((s, g) => s + g.fardigheter.length, 0));
  const ingarForAlla = alla.filter((r) => r.lagen[niva] === "j").length;
  const efterVal = alla.filter((r) => r.lagen[niva] === "v").length;
  const kan = ingarForAlla + efterVal;
  const nya = alla.filter((r) => arNy(r.lagen, niva)).length;

  return (
    <section id="kompetens" className={cn("overflow-x-clip", natt ? "star-avsnitt relative py-16 text-white md:py-24" : "border-b border-line pb-20 pt-14 text-ink md:pb-28 md:pt-20")}>
      <div className="container-site">
        <Reveal>
          {(aktiv || k.kicker) && <p className={cn("kicker", svag)}>{text("kicker", "Raden ovanför", 80)}</p>}
          <h2 className={cn("mt-3", h2)}>{text("rubrik", "Rubriken", 160, { kravs: true, rader: true, visa: radvis })}</h2>
          {(aktiv || k.ingress) && <p className={cn("mt-5 max-w-2xl text-lg leading-relaxed", natt ? "text-white/85" : "text-stone")}>{text("ingress", "Ingressen", 600)}</p>}
        </Reveal>

        {(aktiv || k.program.length > 0) && (
          <RLista
            aktiv={aktiv}
            items={k.program}
            onChange={(nya) =>
              andra((x) => {
                x.program = nya;
              })
            }
            etikett="program"
            ett
            className="mt-8 grid gap-3 md:mt-12 md:grid-cols-2"
            itemClassName="flex min-w-0 rounded-2xl"
            falt={programFalt(k.nivaer)}
            ny={(): Program => ({ niva: "kandidat", typ: "", namn: "", roll: "", text: "", nyckelord: [] })}
            max={4}
            render={(p, i) => (
              <Reveal delay={i * 80} className={cn("flex min-w-0 flex-1 flex-col rounded-2xl border p-6 md:p-8", natt ? "border-white/15 bg-white/[0.04]" : "border-line bg-white")}>
                {p.typ && <p className={cn("kicker", svag)}>{p.typ}</p>}
                <h3 className={cn(p.typ && "mt-3", natt ? "star-type text-2xl font-light md:text-3xl" : "display-tight text-2xl normal-case md:text-3xl")}>{p.namn}</h3>
                {p.roll && <p className="mt-5 text-lg font-semibold leading-snug md:text-xl">{p.roll}</p>}
                {p.text && <p className={cn("mt-3 leading-relaxed", natt ? "text-white/85" : "text-stone")}>{p.text}</p>}
                <ul className="mb-6 mt-5 flex flex-1 flex-wrap content-start gap-1.5">
                  {p.nyckelord.map((ord, j) => (
                    <li key={j} className={cn("rounded-full border px-3 py-1 text-sm font-medium", natt ? "border-white/20 bg-white/[0.05]" : "border-line bg-white")}>
                      {ord}
                    </li>
                  ))}
                </ul>
                {(aktiv || k.programKnapp) && (
                  <button
                    type="button"
                    // I redigeringsläget öppnar ett klick på kortet rutan för programmet, och då ska sidan inte scrolla.
                    onClick={(e) => {
                      if (!e.defaultPrevented) visa(Math.max(0, NIVA_ID.indexOf(p.niva)));
                    }}
                    className="btn btn-ghost-dark btn-sm self-start"
                  >
                    {text("programKnapp", "Knappen", 30)} <ChevronDown size={15} />
                  </button>
                )}
              </Reveal>
            )}
          />
        )}

        <div ref={ankare} className="mt-14 md:mt-20">
          <h2 className={natt ? "star-type text-3xl font-light md:text-4xl" : "display-tight text-2xl md:text-4xl"}>{text("fardigheterRubrik", "Rubriken", 80, { kravs: true })}</h2>
          {(aktiv || k.fardigheterIngress) && (
            <p className={cn("mt-3 max-w-2xl text-lg leading-relaxed", natt ? "text-white/85" : "text-stone")}>{text("fardigheterIngress", "Texten", 400)}</p>
          )}
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
                {k.nivaer.map((n, i) => (
                  <label
                    key={NIVA_ID[i]}
                    className={cn(
                      "group relative flex min-h-10 cursor-pointer select-none flex-wrap items-center justify-center gap-x-1.5 rounded-full px-2 py-1 text-center leading-tight has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 md:min-h-11",
                      natt ? "has-[:focus-visible]:outline-white" : "has-[:focus-visible]:outline-ink",
                    )}
                  >
                    {/* onClick också: ett klick på steget som redan visas ger ingen change, men ska ändå stoppa genomgången. */}
                    <input type="radio" name={namn} value={NIVA_ID[i]} checked={i === niva} onChange={() => valj(i)} onClick={() => valj(i)} className="sr-only" />
                    <span className={cn("text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none md:text-[0.95rem]", i === niva ? (natt ? "text-ink" : "text-paper") : natt ? "text-white/85 group-hover:text-white" : "text-stone group-hover:text-ink")}>{n.etikett}</span>
                    {n.undertitel && (
                      <span className={cn("hidden text-xs transition-colors duration-200 motion-reduce:transition-none md:inline", i === niva ? (natt ? "text-ink/70" : "text-paper/70") : natt ? "text-white/70" : "text-stone")}>{n.undertitel}</span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p aria-live="polite" className="sr-only">
            {k.nivaer[niva].rubrik}: {kan} av {alla.length} färdigheter
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
                {k.nivaer.map((n, i) => {
                  const synlig = i === niva;
                  const pa = aktiv && synlig;
                  return (
                    <div
                      key={NIVA_ID[i]}
                      data-niva={NIVA_ID[i]}
                      className={cn("min-w-0 [grid-area:1/1] transition-[opacity,visibility] duration-300 motion-reduce:transition-none", synlig ? "visible opacity-100" : "invisible opacity-0")}
                    >
                      {pa && (
                        <p className={cn("mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm", svag)}>
                          Namnet i väljaren: {nivaText(i, "etikett", "Stegets namn", 16, true)}
                          <span aria-hidden>·</span>
                          {nivaText(i, "undertitel", "Undertiteln", 24)}
                        </p>
                      )}
                      <h3 className={natt ? "star-type text-3xl font-light" : "display-tight text-2xl md:text-3xl"}>{nivaText(i, "rubrik", "Rubriken", 80, true)}</h3>
                      {(n.text || pa) && <p className={cn("mt-4 leading-relaxed", natt ? "text-white/90" : "text-ink")}>{nivaText(i, "text", "Texten", 600)}</p>}
                      {(n.uppdrag || pa) && (
                        <>
                          {(k.uppdragEtikett || pa) && <p className={cn("kicker mt-6", svag)}>{text("uppdragEtikett", "Rubriken", 40, { aktiv: pa })}</p>}
                          <p className={cn("text-lg font-semibold leading-snug", k.uppdragEtikett || pa ? "mt-2" : "mt-6")}>{nivaText(i, "uppdrag", "Uppdraget", 200)}</p>
                        </>
                      )}
                      {(n.passar || pa) && (
                        <>
                          {(k.passarEtikett || pa) && <p className={cn("kicker mt-6", svag)}>{text("passarEtikett", "Rubriken", 40, { aktiv: pa })}</p>}
                          <p className={cn("leading-snug", natt ? "text-white/90" : "text-ink", k.passarEtikett || pa ? "mt-2" : "mt-6")}>{nivaText(i, "passar", "Passar för", 120)}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-7 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => valj(niva - 1)}
                  aria-label={niva > 0 ? `Föregående steg: ${k.nivaer[niva - 1].etikett}` : undefined}
                  className={cn("btn btn-ghost-dark btn-sm", niva === 0 && "invisible")}
                >
                  <ArrowLeft size={15} /> {k.nivaer[Math.max(0, niva - 1)].etikett}
                </button>
                <button
                  type="button"
                  onClick={() => valj(niva + 1)}
                  aria-label={niva < SISTA ? `Nästa steg: ${k.nivaer[niva + 1].etikett}` : undefined}
                  className={cn("btn btn-ghost-dark btn-sm", niva === SISTA && "invisible")}
                >
                  {k.nivaer[Math.min(SISTA, niva + 1)].etikett} <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-7">
              <div className="mb-7">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={cn("tabular text-4xl leading-none md:text-5xl", natt ? "star-type font-light" : "display-tight")}>{kan}</span>
                  <span className="font-semibold">av {alla.length} färdigheter</span>
                  {/* Finns kvar osynlig på första steget, så att raden tar lika stor plats och inget hoppar på smala skärmar. */}
                  <span className={cn("w-full sm:w-auto", natt ? "text-white/75" : "text-stone", nya === 0 && "invisible")} aria-hidden={nya === 0 || undefined}>
                    {nya === 1 ? "1 ny" : `${nya} nya`} sedan {k.nivaer[Math.max(0, niva - 1)].etikett}
                  </span>
                </p>
                <div aria-hidden className="mt-3 flex gap-1">
                  {alla.map((rad, i) => (
                    <span
                      key={i}
                      style={{ transitionDelay: `${i * 14}ms` }}
                      className={cn("h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none pointer-coarse:transition-none", rad.lagen[niva] === "j" ? "bg-red" : rad.lagen[niva] === "v" ? "bg-red/50" : natt ? "bg-white/15" : "bg-ink/10")}
                    />
                  ))}
                </div>
              </div>

              <RLista
                aktiv={aktiv}
                items={k.grupper}
                onChange={(nya) =>
                  andra((x) => {
                    x.grupper = nya;
                  })
                }
                etikett="grupp"
                as="div"
                className="space-y-6"
                itemAs="div"
                itemClassName="rounded-lg"
                falt={GRUPP_FALT}
                ny={() => ({ namn: "", fardigheter: [] })}
                min={1}
                max={10}
                render={(grupp, gi) => (
                  <>
                    <p className={cn("kicker", svag)}>{grupp.namn}</p>
                    <RLista
                      aktiv={aktiv}
                      items={grupp.fardigheter.map((f) => ({ ...f, grupp: String(gi) }))}
                      onChange={(rader) => andra((x) => lagraFardigheter(x, gi, rader))}
                      etikett="färdighet"
                      className="mt-3 flex flex-wrap gap-2"
                      itemClassName={(rad) =>
                        cn(
                          // Färger kan inte tonas av grafikkortet. På telefonen byter bubblorna läge direkt, så att huvudtråden inte räknar om dem i varje bildruta.
                          "relative inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-[background-color,border-color,color] duration-300 motion-reduce:transition-none pointer-coarse:transition-none",
                          (natt ? CHIP_NATT : CHIP_DAG)[rad.lagen[niva] as KompetensLage],
                        )
                      }
                      itemProps={(rad, i) => ({
                        "data-lage": rad.lagen[niva],
                        "data-ny": arNy(rad.lagen, niva) || undefined,
                        style: { transitionDelay: `${(borjan[gi] + i) * 14}ms` },
                      })}
                      falt={fardighetFalt(k)}
                      ny={() => ({ namn: "", lagen: "jjjj", grupp: String(gi) })}
                      max={MAX_FARDIGHETER}
                      render={(rad) => {
                        const lage = rad.lagen[niva] as KompetensLage;
                        const ny = arNy(rad.lagen, niva);
                        return (
                          <>
                            <Markering lage={lage} />
                            {rad.namn}
                            <span className="sr-only">
                              : {k.lageText[lage].toLowerCase()}
                              {ny && ", ny på den här nivån"}
                            </span>
                            {/* Nytt i steget: en liten röd punkt i hörnet. Den finns alltid och skalas fram, så att bubblan inte ändrar storlek. */}
                            <span
                              aria-hidden
                              className={cn(
                                "pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red ring-2 transition-transform duration-300 motion-reduce:transition-none",
                                natt ? "ring-star-navy" : "ring-paper",
                                ny ? "scale-100" : "scale-0",
                              )}
                            />
                          </>
                        );
                      }}
                    />
                  </>
                )}
              />

              <ul className={cn("mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm", natt ? "border-white/15 text-white/75" : "border-line text-stone")}>
                {(["j", "v", "n"] as const).map((lage) => (
                  <li key={lage} className="inline-flex items-center gap-2">
                    <Markering lage={lage} />
                    <RFalt
                      aktiv={aktiv}
                      varde={k.lageText[lage]}
                      onCommit={(t) =>
                        andra((x) => {
                          x.lageText[lage] = t;
                        })
                      }
                      etikett="Förklaringen"
                      max={60}
                      kravs
                    />
                  </li>
                ))}
                {(aktiv || k.nyText) && (
                  <li className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-red" />
                    {text("nyText", "Förklaringen", 60)}
                  </li>
                )}
              </ul>
              {(aktiv || k.kalla) && <p className={cn("mt-3 text-sm leading-relaxed", natt ? "text-white/75" : "text-stone")}>{text("kalla", "Källan", 600)}</p>}
            </div>
          </div>
        </div>

        {/* Ligger utanför väljarens behållare, så att väljaren inte följer med hit. */}
        {(aktiv || k.guldkorn.length > 0) && (
          <div className="mt-16 md:mt-24">
            <Reveal>
              {(aktiv || k.guldkornKicker) && <p className={cn("kicker", svag)}>{text("guldkornKicker", "Raden ovanför", 80)}</p>}
              {(aktiv || k.guldkornRubrik) && (
                <h2 className={cn("mt-3", natt ? "star-type text-3xl font-light md:text-4xl" : "display-tight text-2xl md:text-4xl")}>{text("guldkornRubrik", "Rubriken", 120)}</h2>
              )}
            </Reveal>
            <RLista
              aktiv={aktiv}
              items={k.guldkorn}
              onChange={(nya) =>
                andra((x) => {
                  x.guldkorn = nya;
                })
              }
              etikett="kort"
              ett
              className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 lg:grid-cols-3"
              itemClassName="flex min-w-0 rounded-2xl"
              falt={GULDKORN_FALT}
              ny={() => ({ kalla: "", rubrik: "", text: "" })}
              max={12}
              render={(g, i) => (
                <Reveal delay={(i % 3) * 60} className={cn("flex min-w-0 flex-1 flex-col rounded-2xl border p-6", natt ? "border-white/15 bg-white/[0.04]" : "border-line bg-white")}>
                  {g.kalla && <p className={cn("kicker", svag)}>{g.kalla}</p>}
                  <h3 className={cn("text-lg font-semibold leading-snug md:text-xl", g.kalla && "mt-3")}>{g.rubrik}</h3>
                  {g.text && <p className={cn("mt-2 leading-relaxed", natt ? "text-white/85" : "text-stone")}>{g.text}</p>}
                </Reveal>
              )}
            />
          </div>
        )}
      </div>
    </section>
  );
}
