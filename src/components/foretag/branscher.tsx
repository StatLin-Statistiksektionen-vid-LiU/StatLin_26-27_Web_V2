"use client";

import { RFalt, RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { ArrowRight } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";
import type { Branscher as BranscherInnehall } from "@/lib/innehall/typer";
import { cn } from "@/lib/utils";

const RED = "var(--color-red)";

/** Prognos med osäkerhetskon. */
function Prognos() {
  return (
    <>
      <path d="M68 24 116 6v32Z" fill={RED} fillOpacity="0.12" stroke="none" />
      <polyline points="4,42 16,35 28,38 40,29 52,31 68,24" />
      <line x1="68" y1="24" x2="116" y2="22" stroke={RED} strokeDasharray="3 4" />
    </>
  );
}

/** Stickprov ur en population. */
function Urval() {
  const valda = new Set([14, 21, 29, 36, 40, 49, 3]);
  return (
    <>
      {Array.from({ length: 52 }, (_, i) => (
        <circle
          key={i}
          cx={6 + (i % 13) * 9}
          cy={8 + Math.floor(i / 13) * 13}
          r={valda.has(i) ? 3 : 1.5}
          fill={valda.has(i) ? RED : "currentColor"}
          fillOpacity={valda.has(i) ? 1 : 0.45}
          stroke="none"
        />
      ))}
    </>
  );
}

/** Överlevnadskurvor med två grupper. */
function Overlevnad() {
  return (
    <>
      <path d="M4 7h20v7h18v9h16v8h22v8h36" />
      <path d="M4 7h32v5h26v5h24v6h30" stroke={RED} />
    </>
  );
}

/** Punkter och en anpassad linje. */
function Regression() {
  const punkter = [
    [8, 44],
    [18, 36],
    [27, 41],
    [38, 30],
    [47, 33],
    [58, 24],
    [66, 28],
    [78, 18],
    [88, 21],
    [99, 11],
    [110, 14],
  ];
  return (
    <>
      {punkter.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.5" fill="currentColor" fillOpacity="0.55" stroke="none" />
      ))}
      <line x1="4" y1="45" x2="116" y2="10" stroke={RED} />
    </>
  );
}

/** Ett litet neuralt nätverk. */
function Natverk() {
  const lager = [
    [14, 28, 42],
    [8, 22, 34, 48],
    [20, 36],
  ];
  const xled = [18, 60, 102];
  const stark = [
    [0, 1, 1, 1],
    [1, 1, 2, 0],
  ];
  return (
    <>
      {lager.slice(0, -1).flatMap((ys, l) =>
        ys.flatMap((y, a) =>
          lager[l + 1].map((y2, b) => (
            <line key={`${l}-${a}-${b}`} x1={xled[l]} y1={y} x2={xled[l + 1]} y2={y2} strokeOpacity="0.2" strokeWidth="1" />
          )),
        ),
      )}
      {stark.map(([l, a, l2, b]) => (
        <line key={`${l}-${a}-${b}`} x1={xled[l]} y1={lager[l][a]} x2={xled[l2]} y2={lager[l2][b]} stroke={RED} />
      ))}
      {lager.flatMap((ys, l) => ys.map((y) => <circle key={`${l}-${y}`} cx={xled[l]} cy={y} r="3.5" fill="var(--figur-bakgrund, var(--color-paper))" />))}
    </>
  );
}

/** Tre grupper av punkter. */
function Kluster() {
  const grupper = [
    { fill: "currentColor", opacity: 0.55, punkter: [[14, 14], [22, 9], [25, 19], [16, 24], [31, 13]] },
    { fill: RED, opacity: 1, punkter: [[58, 34], [66, 28], [70, 38], [61, 44], [75, 32], [52, 40]] },
    { fill: "currentColor", opacity: 0.55, punkter: [[96, 12], [104, 8], [108, 18], [99, 21], [112, 11]] },
  ];
  return (
    <>
      {grupper.flatMap((g, i) => g.punkter.map(([x, y]) => <circle key={`${i}-${x}`} cx={x} cy={y} r="2.5" fill={g.fill} fillOpacity={g.opacity} stroke="none" />))}
    </>
  );
}

const FIGURER = { prognos: Prognos, urval: Urval, overlevnad: Overlevnad, regression: Regression, natverk: Natverk, kluster: Kluster };

type Bransch = BranscherInnehall["lista"][number];

const FALT: Falt<Bransch>[] = [
  { nyckel: "namn", etikett: "Branschens namn", max: 60, kravs: true },
  { nyckel: "text", etikett: "Texten", typ: "lang", max: 400 },
  {
    nyckel: "figur",
    etikett: "Figuren",
    typ: "val",
    alternativ: [
      { varde: "prognos", etikett: "Prognos med osäkerhet" },
      { varde: "urval", etikett: "Stickprov ur en population" },
      { varde: "overlevnad", etikett: "Överlevnadskurvor" },
      { varde: "regression", etikett: "Punkter och en linje" },
      { varde: "natverk", etikett: "Neuralt nätverk" },
      { varde: "kluster", etikett: "Tre grupper av punkter" },
    ],
  },
];

/**
 * Branscher där färdigheterna gör nytta direkt. Figurerna är dekor i samma anda som ämnet, inte data. Natt är STAR-inbjudans utseende:
 * genomskinliga bubblor på natthimlen i stället för rutnätet på den ljusa företagssidan. Allt utom länken längst ner hör till blocket
 * branscher och går att ändra i redigeringsläget.
 */
export function Branscher({ natt = false, innehall, href }: { natt?: boolean; innehall: BranscherInnehall; href: string }) {
  const { varde: b, aktiv, andra } = useBlock("b:branscher", innehall);
  const del = natt ? "starKontakt" : "kontakt";
  const kontakt = b[del];
  const text = (nyckel: "kicker" | "rubrik" | "ingress", etikett: string, max: number, kravs?: boolean) => (
    <RFalt
      aktiv={aktiv}
      varde={b[nyckel]}
      onCommit={(t) =>
        andra((x) => {
          x[nyckel] = t;
        })
      }
      etikett={etikett}
      max={max}
      kravs={kravs}
    />
  );
  const kontaktText = (nyckel: "rubrik" | "text" | "knapp", etikett: string, max: number, kravs?: boolean) => (
    <RFalt
      aktiv={aktiv}
      varde={kontakt[nyckel]}
      onCommit={(t) =>
        andra((x) => {
          x[del][nyckel] = t;
        })
      }
      etikett={etikett}
      max={max}
      kravs={kravs}
    />
  );

  return (
    <section className={cn("py-16 md:py-24", natt && "star-avsnitt relative")}>
      <div className="container-site">
        <Reveal>
          {(aktiv || b.kicker) && <p className={cn("kicker", natt ? "text-white/70" : "text-stone")}>{text("kicker", "Raden ovanför", 60)}</p>}
          <h2 className={cn("mt-3 max-w-4xl", natt ? "star-type text-[clamp(1.9rem,5vw,3.5rem)] font-light uppercase leading-[1.05] tracking-[0.06em]" : "display-tight text-3xl md:text-5xl")}>
            {text("rubrik", "Rubriken", 120, true)}
          </h2>
          {(aktiv || b.ingress) && <p className={cn("mt-4 max-w-2xl text-lg leading-relaxed", natt ? "text-white/85" : "text-stone")}>{text("ingress", "Ingressen", 500)}</p>}
        </Reveal>

        {(aktiv || b.lista.length > 0) && (
          <RLista
            aktiv={aktiv}
            items={b.lista}
            onChange={(nya) =>
              andra((x) => {
                x.lista = nya;
              })
            }
            etikett="bransch"
            className={cn(
              "mt-10 grid sm:grid-cols-2 lg:grid-cols-3",
              // Rutnätet har hårfina linjer mellan rutorna. I redigeringsläget står ramen och handtaget innanför rutan, där de syns.
              natt ? "gap-3" : "redigerbar-inne gap-px overflow-hidden rounded-xl border border-line bg-line",
            )}
            itemClassName={cn(
              "min-w-0 p-6 md:p-7",
              natt ? "rounded-2xl border border-white/15 bg-white/[0.04]" : "bg-white",
            )}
            falt={FALT}
            ny={(): Bransch => ({ namn: "", text: "", figur: "regression" })}
            max={12}
            render={(rad) => {
              const Figur = FIGURER[rad.figur] ?? Regression;
              return (
                <>
                  <svg
                    aria-hidden
                    viewBox="0 0 120 56"
                    className={cn("h-14 w-auto", natt ? "text-white [--figur-bakgrund:var(--color-star-navy)]" : "text-ink")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Figur />
                  </svg>
                  <h3 className={cn("mt-5 text-xl", natt ? "star-type font-normal" : "display-tight normal-case")}>{rad.namn}</h3>
                  {rad.text && <p className={cn("mt-2 leading-relaxed", natt ? "text-white/85" : "text-stone")}>{rad.text}</p>}
                </>
              );
            }}
          />
        )}

        <div className="mt-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            {(aktiv || kontakt.rubrik) && <p className={natt ? "star-type text-2xl font-light md:text-3xl" : "display-tight text-2xl md:text-3xl"}>{kontaktText("rubrik", "Rubriken", 120)}</p>}
            {(aktiv || kontakt.text) && <p className={cn("mt-2 max-w-xl", natt ? "text-white/85" : "text-stone")}>{kontaktText("text", "Texten", 300)}</p>}
          </div>
          <a href={href} className={cn("btn shrink-0", natt ? "btn-red" : "btn-ink")}>
            {kontaktText("knapp", "Knappens text", 40, true)} <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
