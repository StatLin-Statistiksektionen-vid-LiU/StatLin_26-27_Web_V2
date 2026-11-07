"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { RadRuta } from "@/components/edit-mode/redigera/ruta";
import type { Falt } from "@/components/edit-mode/redigerbar";
import { Plus } from "@/components/icons";
import { forekomster, type Anteckning, type Drag, type Lage, type Punkt } from "./anteckning-lager";

/*
 * Anteckningarna i redigeringsläget (AnteckningLager). Anteckningen dras dit den ska stå, pilens spets dras till ordet den ska peka
 * på, och ett klick öppnar rutan där texten, ordet och färgen ändras och där den tas bort. Läget sparas i förhållande till ordet.
 */

type Item = Record<string, unknown>;

const FALT: Falt<Anteckning>[] = [
  { nyckel: "text", etikett: "Anteckningen", max: 40, kravs: true },
  {
    nyckel: "mal",
    etikett: "Pekar på",
    max: 40,
    hjalp: "Ett ord på sidan. Tomt pekar på slutet av rubriken. Du kan också dra pilens spets till ordet.",
  },
  { nyckel: "rod", etikett: "Rödpenna", typ: "vaxel" },
];

const SYNS = {
  annan: "Får inte plats här, så besökare ser den vid ordet",
  inte: "Får inte plats här, så besökare ser den inte",
  saknas: "Hittar inte ordet, så besökare ser den inte",
} as const;

/** Steget för piltangenterna, i pixlar. Med Skift tio gånger så långt. */
const STEG = 8;

/** Ordet under punkten i fönstret, med vilken av ordets förekomster i sidan det är och dess ruta. */
function ordVid(x: number, y: number, rot: Element): { ord: string; nr: number; q: DOMRect } | null {
  let nod: Node | null = null;
  let plats = 0;
  const pos = document.caretPositionFromPoint?.(x, y);
  if (pos) {
    nod = pos.offsetNode;
    plats = pos.offset;
  } else {
    const r = document.caretRangeFromPoint?.(x, y);
    if (r) {
      nod = r.startContainer;
      plats = r.startOffset;
    }
  }
  if (!nod || nod.nodeType !== Node.TEXT_NODE || !rot.contains(nod)) return null;
  const s = (nod as Text).data;
  const bokstav = /[\p{L}\p{N}]/u;
  let a = plats;
  let b = plats;
  while (a > 0 && bokstav.test(s[a - 1])) a--;
  while (b < s.length && bokstav.test(s[b])) b++;
  if (a === b) return null;
  const range = document.createRange();
  range.setStart(nod, a);
  range.setEnd(nod, b);
  const q = range.getBoundingClientRect();
  // Platsen för markören hamnar i närmaste text, även en bit bort. Pekaren ska vara på ordet.
  if (x < q.left - 6 || x > q.right + 6 || y < q.top - 6 || y > q.bottom + 6) return null;
  const ord = s.slice(a, b);
  let nr = 0;
  for (const f of forekomster(rot, ord, document.createRange())) {
    if (f.n === nod && f.start === a) return { ord, nr, q };
    nr++;
  }
  return null;
}

export default function AnteckningRedigerare({
  a,
  lage,
  lapp,
  oppnas,
  onOppnad,
  onDrag,
  onAndra,
}: {
  a: Anteckning;
  lage: Lage;
  lapp: RefObject<HTMLDivElement | null>;
  oppnas: boolean;
  onOppnad: () => void;
  onDrag: (drag: Drag | null) => void;
  onAndra: (nytt: Anteckning | null) => void;
}) {
  // En ny anteckning öppnar sin ruta direkt, när den har fått en plats och den här delen visas första gången.
  const [oppen, setOppen] = useState(oppnas);
  // Var pekaren och anteckningen var när draget började. Under draget är lage redan flyttad, så slutet räknas härifrån.
  const start = useRef<{ x: number; y: number; l: number; t: number; dragit: boolean } | null>(null);
  // Ett klick kommer efter varje drag. Det ska inte öppna rutan.
  const nyssDragen = useRef(false);
  const spets = useRef<HTMLButtonElement>(null);
  const grepp = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (oppnas) onOppnad();
  }, [oppnas, onOppnad]);

  /** Sparar var anteckningen står, i förhållande till ordet. */
  function stall(l: number, t: number) {
    if (!lage.mal) return;
    onAndra({ ...a, x: Math.round(l - lage.mal.l), y: Math.round(t - lage.mal.t) });
  }

  function ner(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, l: lage.box.l, t: lage.box.t, dragit: false };
  }
  function flytta(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.dragit && Math.hypot(dx, dy) < 4) return;
    s.dragit = true;
    onDrag({ dx, dy });
  }
  function upp(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    start.current = null;
    if (!s?.dragit) return;
    nyssDragen.current = true;
    onDrag(null);
    stall(s.l + e.clientX - s.x, s.t + e.clientY - s.y);
  }
  function avbryt() {
    if (!start.current) return;
    start.current = null;
    onDrag(null);
  }
  function tangent(e: KeyboardEvent<HTMLButtonElement>) {
    const steg = e.shiftKey ? STEG * 10 : STEG;
    const pilar: Record<string, Punkt | undefined> = { ArrowLeft: [-steg, 0], ArrowRight: [steg, 0], ArrowUp: [0, -steg], ArrowDown: [0, steg] };
    const d = pilar[e.key];
    if (!d) return;
    e.preventDefault();
    stall(lage.box.l + d[0], lage.box.t + d[1]);
  }

  /** Lagrets hörn i fönstret, för pilens spets som följer pekaren. */
  const horn = (): Punkt => {
    const q = lapp.current?.parentElement?.getBoundingClientRect();
    return q ? [q.left, q.top] : [0, 0];
  };
  function nerSpets(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, l: lage.box.l, t: lage.box.t, dragit: true };
  }
  function flyttaSpets(e: PointerEvent<HTMLButtonElement>) {
    if (!start.current) return;
    const [l, t] = horn();
    onDrag({ spets: [e.clientX - l, e.clientY - t] });
  }
  function uppSpets(e: PointerEvent<HTMLButtonElement>) {
    if (!start.current) return;
    start.current = null;
    onDrag(null);
    const rot = document.getElementById("innehall");
    if (!rot) return;
    // Spetsen och anteckningen ska inte vara i vägen när ordet under pekaren letas upp.
    const dolda = [spets.current, grepp.current].filter((el): el is HTMLButtonElement => !!el);
    for (const el of dolda) el.style.pointerEvents = "none";
    const traff = ordVid(e.clientX, e.clientY, rot);
    for (const el of dolda) el.style.pointerEvents = "";
    if (!traff) return;
    const [l, t] = horn();
    // Anteckningen står kvar där den är, räknat från det nya ordet.
    const nytt: Anteckning = { ...a, mal: traff.ord, x: Math.round(lage.box.l - (traff.q.left - l)), y: Math.round(lage.box.t - (traff.q.top - t)) };
    if (traff.nr) nytt.nr = traff.nr;
    else delete nytt.nr;
    onAndra(nytt);
  }

  const { box, e: slut, syns } = lage;
  return (
    <>
      <button
        ref={grepp}
        type="button"
        className="anteckning-grepp"
        aria-label={`Anteckningen ${a.text}. Klicka för att ändra, dra eller använd piltangenterna för att flytta.`}
        title="Klicka för att ändra, dra för att flytta"
        onPointerDown={ner}
        onPointerMove={flytta}
        onPointerUp={upp}
        onPointerCancel={avbryt}
        onKeyDown={tangent}
        onClick={() => {
          if (nyssDragen.current) {
            nyssDragen.current = false;
            return;
          }
          setOppen(true);
        }}
      />
      {lage.mal && (
        <button
          ref={spets}
          type="button"
          className="anteckning-spets"
          aria-label="Pilens spets. Dra den till ordet som anteckningen ska peka på."
          title="Dra till ordet som anteckningen ska peka på"
          style={{ left: slut[0] - box.l, top: slut[1] - box.t }}
          onPointerDown={nerSpets}
          onPointerMove={flyttaSpets}
          onPointerUp={uppSpets}
          onPointerCancel={avbryt}
        />
      )}
      {syns !== "har" && <span className="anteckning-etikett">{SYNS[syns]}</span>}
      {oppen && (
        <RadRuta
          ankare={() => lapp.current}
          rubrik="Ändra anteckning"
          item={a as unknown as Item}
          falt={FALT as unknown as Falt<Item>[]}
          kanTaBort
          kanUpp={false}
          kanNer={false}
          onSpara={(nytt) => {
            const n = nytt as unknown as Anteckning;
            // Ett nytt ord: anteckningen hamnar vid det, på en plats som väljs som från början.
            if (n.mal.trim() !== a.mal.trim()) {
              delete n.nr;
              delete n.x;
              delete n.y;
            }
            onAndra(n);
          }}
          onTaBort={() => {
            setOppen(false);
            onAndra(null);
          }}
          onFlytta={() => undefined}
          onStang={() => setOppen(false)}
        />
      )}
    </>
  );
}

/** Knappen som lägger till en anteckning på sidan man står på. Den står överst, mitt över sidan. */
export function NyKnapp({ kan, onNy }: { kan: boolean; onNy: () => void }) {
  return createPortal(
    <button type="button" className="anteckning-ny" onClick={onNy} disabled={!kan} title={kan ? "Lägg till en anteckning med pil på den här sidan" : "Högst 40 anteckningar"}>
      <Plus size={14} /> Ny anteckning
    </button>,
    document.body,
  );
}
