"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { forbered, Orden, useSkrivning } from "@/components/content/skrivning";
import { RText } from "@/components/edit-mode/redigerbar";

/*
 * En anteckning för hand med en pil till ett ord, som någon har skrivit i marginalen. Den läggs i en ruta som täcker sin förälder
 * (som ska ha position: relative) och mäter var ordet står. Sedan provas några platser kring ordet, och anteckningen hamnar på den
 * första där den får plats utan att täcka någon text, länk eller knapp. Får den inte plats någonstans, som ofta på en smal telefon,
 * syns den inte. Den skrivs med bläck, och med rödpenna om texten står inom *stjärnor*.
 */

type Punkt = [number, number];
type Placering = "over-snett" | "over-hoger" | "hoger" | "over";
type Lage = { x: number; y: number; pil: string; huvud: string };

const STANDARD: readonly Placering[] = ["over-hoger", "hoger", "over"];
const PER_TECKEN = 50;
const PAUS = 100;
const FORDROJNING = 900;
const PIL = 420;
const HUVUD = 180;

/** Ett tal med en decimal, för pilens koordinater. */
const t1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Rutan runt ordet, eller runt sista tecknet när inget ord är angivet eller ordet inte står kvar. Ordet räknas från början av ett
 * ord, så sektion hittar även sektionen.
 */
function malRuta(mal: Element, ord?: string): DOMRect | null {
  const traff = ord ? new RegExp(`(^|[^\\p{L}])(${ord}\\p{L}*)`, "iu") : null;
  const range = document.createRange();
  const walker = document.createTreeWalker(mal, NodeFilter.SHOW_TEXT);
  let sista: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const s = n.data;
    if (!s.trim()) continue;
    sista = n;
    if (!traff) continue;
    const m = traff.exec(s);
    if (!m) continue;
    const start = m.index + m[1].length;
    range.setStart(n, start);
    range.setEnd(n, start + m[2].length);
    return range.getClientRects()[0] ?? null;
  }
  if (!sista) return null;
  const slut = sista.data.trimEnd().length;
  range.setStart(sista, slut - 1);
  range.setEnd(sista, slut);
  const rutor = range.getClientRects();
  return rutor[rutor.length - 1] ?? null;
}

/** Pilen: en båge från start till slut som buktar uppåt, och ett pilhuvud i bågens riktning. */
function pil([sx, sy]: Punkt, [ex, ey]: Punkt) {
  const dx = ex - sx;
  const dy = ey - sy;
  const l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l;
  let ny = dx / l;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const k = Math.min(0.32 * l, 26);
  const cx = (sx + ex) / 2 + nx * k;
  const cy = (sy + ey) / 2 + ny * k;
  const tl = Math.hypot(ex - cx, ey - cy) || 1;
  const ux = (ex - cx) / tl;
  const uy = (ey - cy) / tl;
  const spets = (a: number): Punkt => [ex - 10 * (ux * Math.cos(a) - uy * Math.sin(a)), ey - 10 * (uy * Math.cos(a) + ux * Math.sin(a))];
  const [h1, h2] = [spets(0.5), spets(-0.5)];
  return {
    pil: `M${t1(sx)} ${t1(sy)}Q${t1(cx)} ${t1(cy)} ${t1(ex)} ${t1(ey)}`,
    huvud: `M${t1(h1[0])} ${t1(h1[1])}L${t1(ex)} ${t1(ey)}L${t1(h2[0])} ${t1(h2[1])}`,
  };
}

/** Sidhuvudets höjd i pixlar, så att anteckningen inte hamnar under det fasta huvudet på telefonen. */
function huvudHojd() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim();
  const n = parseFloat(v) || 0;
  return v.endsWith("rem") ? n * parseFloat(getComputedStyle(document.documentElement).fontSize) : n;
}

/**
 * text är anteckningen, mal en CSS-väljare för elementet den pekar på (inuti föräldern) och ord ordet i det. id gör den
 * redigerbar där den står, som startsidans texter. placeringar är platserna som provas, i tur och ordning.
 */
export function Anteckning({
  text,
  mal,
  ord,
  id,
  placeringar = STANDARD,
}: {
  text: string;
  mal: string;
  ord?: string;
  id?: `s:${string}`;
  placeringar?: readonly Placering[];
}) {
  const rod = /\*[^*]+\*/.test(text);
  const ren = text.replace(/\*+([^*]+)\*+/g, "$1").trim();
  const { ord: orden, slut } = forbered(ren, 0, PER_TECKEN, PAUS);
  const lager = useSkrivning<HTMLDivElement>(`anteckning:${ren}`, ren, false, FORDROJNING, slut + PIL + HUVUD + 200);
  const lapp = useRef<HTMLDivElement>(null);
  const [lage, setLageRa] = useState<Lage | null>(null);
  const ordning = placeringar.join(",");

  useLayoutEffect(() => {
    const ruta = lager.current;
    const el = lapp.current;
    const behallare = ruta?.parentElement;
    if (!ruta || !el || !behallare) return;
    let raf = 0;
    // Samma läge som förut ger ingen ny rendering, så att mätningen inte går runt i en slinga.
    const setLage = (ny: Lage | null) =>
      setLageRa((gammal) => (gammal?.x === ny?.x && gammal?.y === ny?.y && gammal?.pil === ny?.pil ? gammal : ny));

    const berakna = () => {
      raf = 0;
      const malEl = behallare.querySelector(mal);
      const c = ruta.getBoundingClientRect();
      const m = malEl && malRuta(malEl, ord);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!m || !w || !c.width) return setLage(null);
      const t = { l: m.left - c.left, r: m.right - c.left, t: m.top - c.top, b: m.bottom - c.top, w: m.width, h: m.height };

      // Det som anteckningen inte får täcka: all text och allt man kan klicka på i föräldern.
      const hinder: { l: number; t: number; r: number; b: number }[] = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(behallare, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim() || ruta.contains(n)) continue;
        range.selectNodeContents(n);
        for (const q of range.getClientRects()) hinder.push({ l: q.left - c.left, t: q.top - c.top, r: q.right - c.left, b: q.bottom - c.top });
      }
      for (const e of behallare.querySelectorAll("a, button, img, input, textarea, select, svg")) {
        if (ruta.contains(e)) continue;
        const q = e.getBoundingClientRect();
        if (q.width && q.height) hinder.push({ l: q.left - c.left, t: q.top - c.top, r: q.right - c.left, b: q.bottom - c.top });
      }
      const minY = Math.max(6, huvudHojd() + 6 - (c.top + window.scrollY));

      const forslag: Record<Placering, () => { x: number; y: number; s: Punkt; e: Punkt }> = {
        // Ovanför ordet med början över dess mitt, och en kort pil ner mot ordet.
        "over-snett": () => {
          const x = t.l + t.w * 0.55;
          const y = t.t - h - 40;
          return { x, y, s: [x - 6, y + h * 0.7], e: [t.l + t.w * 0.42, t.t - 5] };
        },
        // Snett ovanför ordets slut, med pilen ner mot ordet.
        "over-hoger": () => {
          const x = t.r + 26;
          const y = t.t - h - 10;
          return { x, y, s: [x - 6, y + h * 0.72], e: [t.r - Math.min(t.w * 0.3, 18), t.t - 3] };
        },
        // Till höger om ordet på samma rad.
        hoger: () => {
          const x = t.r + 44;
          const y = t.t + t.h / 2 - h / 2 - 4;
          return { x, y, s: [x - 8, y + h * 0.62], e: [t.r + 8, t.t + t.h / 2] };
        },
        // Rakt ovanför ordet.
        over: () => {
          const x = t.l + t.w / 2 - w / 2 + 14;
          const y = t.t - h - 26;
          return { x, y, s: [x + w / 2 - 14, y + h + 2], e: [t.l + t.w / 2, t.t - 4] };
        },
      };
      for (const namn of ordning.split(",") as Placering[]) {
        const f = forslag[namn]();
        const ram = { l: f.x - 8, t: f.y - 8, r: f.x + w + 8, b: f.y + h + 8 };
        if (ram.l < 6 || ram.t < minY || ram.r > c.width - 6 || ram.b > c.height - 4) continue;
        if (hinder.some((q) => q.l < ram.r && q.r > ram.l && q.t < ram.b && q.b > ram.t)) continue;
        return setLage({ x: Math.round(f.x), y: Math.round(f.y), ...pil(f.s, f.e) });
      }
      setLage(null);
    };
    berakna();
    const igen = () => {
      if (!raf) raf = requestAnimationFrame(berakna);
    };
    // Om om när något ändrar storlek, och när typsnitten har kommit (Mynerve och Archivo ger lite olika bredder).
    const ro = new ResizeObserver(igen);
    ro.observe(behallare);
    ro.observe(el);
    document.fonts.addEventListener("loadingdone", igen);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.fonts.removeEventListener("loadingdone", igen);
    };
  }, [lager, mal, ord, ren, ordning]);

  return (
    <div ref={lager} aria-hidden={id ? undefined : true} className={rod ? "handskrift anteckning-lager hs-rod" : "handskrift anteckning-lager"}>
      <div
        ref={lapp}
        className={id ? "anteckning pointer-events-auto" : "anteckning"}
        style={lage ? { left: lage.x, top: lage.y } : { left: 0, top: 0, visibility: "hidden" }}
      >
        {id ? <RText id={id} value={text} visa={(v) => <Orden ord={forbered(v.replace(/\*+([^*]+)\*+/g, "$1").trim(), 0, PER_TECKEN, PAUS).ord} />} /> : <Orden ord={orden} />}
      </div>
      {lage && (
        <svg aria-hidden className="hs-ritning anteckning-pil" strokeWidth={1.8}>
          <path pathLength={1} d={lage.pil} style={{ "--rd": slut + 120, "--rt": PIL } as CSSProperties} />
          <path pathLength={1} d={lage.huvud} style={{ "--rd": slut + 120 + PIL, "--rt": HUVUD } as CSSProperties} />
        </svg>
      )}
    </div>
  );
}
