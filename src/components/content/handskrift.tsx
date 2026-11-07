"use client";

import { lazy, Suspense, useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { forbered, Orden, useSkrivning } from "@/components/content/skrivning";
import { RFalt, RLista, type Falt } from "@/components/edit-mode/redigerbar";
import { useBlock } from "@/components/edit-mode/utkast";
import { satFormler } from "@/components/layout/formel-kalla";
import type { Handskrift } from "@/lib/innehall/typer";

/*
 * Text som skrivs fram för hand: anteckningen med pilen mot loggan på startsidan och citatet i sidfoten (src/lib/innehall/block/handskrift.ts).
 * Orden skrivs med pennan i skrivning.tsx, och sedan ritas strecken (pilen, understrykningen, ringen) med stroke-dashoffset.
 */

/* ---------- Anteckningen vid loggan ---------- */

const PIL_START = 1300;

/**
 * Anteckningen till vänster om loggan i heron, i rött med en pil upp mot loggan. Ligger i figuren och står bredvid den, där
 * det finns plats från xl. Redaktören ändrar texten där den står.
 */
export function HeroAnteckning({ handskrift }: { handskrift: Handskrift }) {
  const { varde, aktiv, andra } = useBlock("b:handskrift", handskrift);
  const text = varde.figur.trim();
  const { slut } = forbered(text, 0, 60, 120);
  const ref = useSkrivning<HTMLDivElement>(`figur:${text}`, text, aktiv, PIL_START, slut + 750);
  if (!text && !aktiv) return null;
  return (
    <div ref={ref} className="handskrift pointer-events-none absolute inset-0 hidden xl:block">
      <p className="pointer-events-auto absolute right-[calc(100%+1.25rem)] top-[86%] w-max max-w-[9.5rem] -rotate-[4deg] text-right text-[1.5rem] leading-[1.15] text-red">
        <RFalt
          aktiv={aktiv}
          varde={text}
          onCommit={(t) =>
            andra((x) => {
              x.figur = t;
            })
          }
          etikett="Anteckningen vid loggan"
          max={20}
          visa={(t) => <Orden ord={forbered(t, 0, 60, 120).ord} />}
        />
      </p>
      {text && (
        // Pilen går från anteckningens slut upp mot ringen runt loggan. Rutan har nästan samma proportioner i alla bredder från xl.
        <svg aria-hidden viewBox="0 0 104 76" preserveAspectRatio="none" className="hs-ritning absolute left-[-1rem] top-[73%] h-[19%] w-[calc(22%+1rem)] text-red" strokeWidth={2}>
          <path pathLength={1} d="M3 66C40 74 78 52 99 14" style={{ "--rd": slut + 80, "--rt": 480 } as CSSProperties} />
          <path pathLength={1} d="M89.6 19.7 99 14 99.2 25" style={{ "--rd": slut + 540, "--rt": 200 } as CSSProperties} />
        </svg>
      )}
    </div>
  );
}

/* ---------- Citaten i sidfoten ---------- */

type Citat = Handskrift["citat"][number];

const FALT: Falt<Citat>[] = [
  { nyckel: "text", etikett: "Citatet", typ: "lang", max: 140, kravs: true, hjalp: "Skriv _ för index och ^ för exponent, som β_1 och x^2. Citattecknen kommer av sig själva." },
  { nyckel: "vem", etikett: "Vem sa det", max: 60 },
  {
    nyckel: "ritning",
    etikett: "Ritat för hand",
    typ: "val",
    alternativ: [
      { varde: "understrykning", etikett: "Understrykning under namnet" },
      { varde: "ring", etikett: "Ring runt namnet" },
      { varde: "ingen", etikett: "Inget" },
    ],
  },
];

/** Strecket vid namnet. d är när det börjar ritas. */
function Ritning({ typ, d }: { typ: Citat["ritning"]; d: number }) {
  if (typ === "understrykning") {
    return (
      <svg aria-hidden viewBox="0 0 160 14" preserveAspectRatio="none" className="hs-ritning absolute left-[-4%] top-[86%] h-[0.6em] w-[108%] text-red" strokeWidth={2.2}>
        <path pathLength={1} d="M3 9C42 3 88 12 157 5" style={{ "--rd": d, "--rt": 420 } as CSSProperties} />
      </svg>
    );
  }
  if (typ === "ring") {
    return (
      // Ringen går lika långt ut på sidorna oavsett hur långt namnet är, så att den får plats i marginalen på smala telefoner.
      <svg aria-hidden viewBox="0 0 200 60" preserveAspectRatio="none" className="hs-ritning absolute left-[-0.8em] -inset-y-[48%] h-[196%] w-[calc(100%+1.6em)] text-red" strokeWidth={2}>
        <path pathLength={1} d="M150 6C186 9 199 24 192 38 182 56 60 60 20 48-4 40 2 18 30 10 62 2 128 2 168 12" style={{ "--rd": d, "--rt": 620 } as CSSProperties} />
      </svg>
    );
  }
  return null;
}

/** Ett citat i handstil. Tiderna räknas här, så att namnet skrivs efter citatet och strecket ritas sist. */
function CitatVy({ citat }: { citat: Citat }) {
  const text = forbered(`”${citat.text.trim()}”`, 0, 40, 70);
  const vem = forbered(citat.vem.trim(), text.slut + 260, 45, 70);
  return (
    <>
      <blockquote className="text-[1.45rem] leading-[1.22] text-ink">
        <Orden ord={text.ord} />
      </blockquote>
      {vem.ord.length > 0 && (
        <figcaption className="mt-2 text-right text-[1.2rem] leading-none text-stone">
          <span className="relative inline-block">
            <Orden ord={vem.ord} />
            <Ritning typ={citat.ritning} d={vem.slut + 120} />
          </span>
        </figcaption>
      )}
    </>
  );
}

/** Hur länge citatet tar att skriva, med strecket. */
function citatLangd(citat: Citat) {
  const text = forbered(`”${citat.text.trim()}”`, 0, 40, 70);
  const vem = forbered(citat.vem.trim(), text.slut + 260, 45, 70);
  return vem.slut + (citat.ritning === "ingen" || !vem.ord.length ? 0 : 120 + 620);
}

/** Ett slumptal per sidladdning, taget första gången det behövs i webbläsaren. Servern och hydreringen får 0, sedan byter React. */
const FormelLista = lazy(() => import("./formel-lista"));

let slump: number | undefined;
const taSlump = () => (slump ??= Math.random());
const prenumerera = () => () => {};

/**
 * Citatet i sidfoten, ett av dem slumpvis vid varje besök. Det väljs först när sidan har laddats, medan citatet ännu är dolt,
 * så att det inte byts framför ögonen på någon. I redigeringsläget står alla citat i en lista, där de ändras, läggs till och
 * byter ordning, och under dem formlerna som skrivs i rutnätet. Sidfoten lämnar formlerna till rutnätet (formel-kalla.ts).
 */
export function SidfotCitat({ handskrift }: { handskrift: Handskrift }) {
  const { varde, aktiv, andra } = useBlock("b:handskrift", handskrift);
  useEffect(() => satFormler(varde.formler), [varde.formler]);
  const alla = varde.citat.filter((c) => c.text.trim());
  // Väljs en gång per sidladdning. Sidfoten ligger kvar när man byter sida, och citatet med den.
  const tal = useSyncExternalStore(prenumerera, taSlump, () => 0);
  const citat = alla[Math.floor(tal * alla.length)] ?? alla[0];
  const ref = useSkrivning<HTMLElement>(`citat:${citat?.text ?? ""}`, citat ? `”${citat.text}” ${citat.vem}` : "", aktiv || !citat, 0, citat ? citatLangd(citat) : 0);

  if (aktiv) {
    return (
      <div data-skriv="klar" className="handskrift mt-7 max-w-sm">
        <RLista
          aktiv
          items={varde.citat}
          onChange={(nya) =>
            andra((h) => {
              h.citat = nya;
            })
          }
          etikett="citat"
          ett
          as="div"
          className="space-y-5"
          itemAs="figure"
          falt={FALT}
          ny={(): Citat => ({ text: "Nytt citat", vem: "", ritning: "understrykning" })}
          max={8}
          render={(c) =>
            c.text.trim() ? (
              <CitatVy citat={c} />
            ) : (
              <span className="text-[1rem] text-stone" title="Citatet har ingen text och visas inte.">
                Tomt citat
              </span>
            )
          }
        />
        <Suspense fallback={null}>
          <FormelLista
            formler={varde.formler}
            onChange={(nya) =>
              andra((h) => {
                h.formler = nya;
              })
            }
          />
        </Suspense>
      </div>
    );
  }
  if (!citat) return null;
  return (
    <figure ref={ref} className="handskrift mt-7 max-w-sm">
      <CitatVy citat={citat} />
    </figure>
  );
}
