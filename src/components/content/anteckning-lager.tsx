"use client";

import { usePathname } from "next/navigation";
import { lazy, Suspense, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { forbered, Orden, useSkrivning } from "@/components/content/skrivning";
import { useBlock } from "@/components/edit-mode/utkast";
import type { Anteckningar } from "@/lib/innehall/typer";

/*
 * Anteckningarna för hand med en pil mot ett ord, som någon har skrivit i marginalen. De står i blocket Anteckningarna, och lagret
 * täcker sidan och sidfoten. Varje anteckning letar upp sitt ord i sidan (eller slutet av rubriken) och står där den lades, räknat
 * från ordet, så att den följer med ordet på alla skärmar. Krockar den med text, en länk eller en knapp, eller får den inte plats,
 * provas några platser kring ordet, och får den inte plats någonstans syns den inte. I redigeringsläget står den där den lades även
 * när den krockar, med en streckad ram, och går att dra, peka om, ändra och ta bort (anteckning-redigerare.tsx, som laddas först då).
 */

export type Anteckning = Anteckningar["lista"][number];
export type Punkt = [number, number];
export type Ruta = { l: number; t: number; r: number; b: number };
/**
 * Var anteckningen står och vart pilen går, i lagrets koordinater. syns: besökare ser den här, på en annan plats vid ordet, inte
 * alls, eller så finns inte ordet på sidan. Det skiljer sig från har bara i redigeringsläget.
 */
export type Lage = { box: Ruta; mal: Ruta | null; s: Punkt; e: Punkt; syns: "har" | "annan" | "inte" | "saknas" };

const Redigerare = lazy(() => import("./anteckning-redigerare"));
const NyKnapp = lazy(() => import("./anteckning-redigerare").then((m) => ({ default: m.NyKnapp })));

const PER_TECKEN = 50;
const PAUS = 100;
const FORDROJNING = 900;
const PIL = 420;
const HUVUD = 180;
/** Det som anteckningen inte får täcka, utöver text. */
const KLICKBART = "a, button, img, input, textarea, select, svg, video, canvas, iframe";

type Plats = "over-snett" | "over-hoger" | "hoger" | "over";
const VID_ORD: readonly Plats[] = ["over-snett", "over", "over-hoger", "hoger"];
const VID_RUBRIK: readonly Plats[] = ["over-hoger", "hoger", "over"];

const t1 = (v: number) => Math.round(v * 10) / 10;
const klamra = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b));
const ruta = (x: number, y: number, w: number, h: number): Ruta => ({ l: x, t: y, r: x + w, b: y + h });

/** Sidhuvudets höjd i pixlar, så att anteckningen inte hamnar under det fasta huvudet på telefonen. */
function huvudHojd() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim();
  const n = parseFloat(v) || 0;
  return v.endsWith("rem") ? n * parseFloat(getComputedStyle(document.documentElement).fontSize) : n;
}

/** Rutan runt sista tecknet i elementet, eller null när det inte syns. */
function sistaTecken(el: Element, range: Range): DOMRect | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let sista: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) if (n.data.trim()) sista = n;
  if (!sista) return null;
  const slut = sista.data.trimEnd().length;
  range.setStart(sista, slut - 1);
  range.setEnd(sista, slut);
  const rutor = range.getClientRects();
  return rutor[rutor.length - 1] ?? null;
}

const ordRegel = (ord: string) => new RegExp(`(^|[^\\p{L}\\p{N}])(${ord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\p{L}\\p{N}]*)`, "giu");

/**
 * Ordets förekomster i sidan som syns, i ordning, med text-noden och var ordet börjar. Ett ord räknas från början av ett ord, så
 * sektion hittar även sektionen. Det som är dolt, som förra sidan som Next behåller i dokumentet, hoppas över.
 */
export function* forekomster(rot: Element, ord: string, range: Range): Generator<{ n: Text; start: number; q: DOMRect }> {
  const regel = ordRegel(ord);
  const walker = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!n.data.trim()) continue;
    regel.lastIndex = 0;
    for (let m = regel.exec(n.data); m; m = regel.exec(n.data)) {
      const start = m.index + m[1].length;
      range.setStart(n, start);
      range.setEnd(n, start + m[2].length);
      const q = range.getClientRects()[0];
      if (!q) break;
      yield { n, start, q };
    }
  }
}

/** Rutan runt ordet, dess nr:te förekomst, eller runt sista tecknet i rubriken när ordet är tomt. */
function hittaMal(rot: Element, mal: string, nr: number, range: Range): DOMRect | null {
  if (!mal.trim()) {
    for (const valjare of ["h1", "h2"]) for (const h of rot.querySelectorAll(valjare)) {
      const q = sistaTecken(h, range);
      if (q) return q;
    }
    return null;
  }
  let i = 0;
  for (const { q } of forekomster(rot, mal.trim(), range)) if (i++ === nr) return q;
  return null;
}

/** Täcker rutan (i fönstrets koordinater) någon text eller något man kan klicka på i sidan? Delar som ligger utanför hoppas över. */
function krockar(rot: Element, ram: Ruta, range: Range): boolean {
  const utanfor = (q: DOMRect) => q.right <= ram.l || q.left >= ram.r || q.bottom <= ram.t || q.top >= ram.b;
  const walker = document.createTreeWalker(rot, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
      const q = (n as Element).getBoundingClientRect();
      return (q.width > 0 || q.height > 0) && utanfor(q) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (!utanfor(q)) return true;
    } else if ((n as Element).matches(KLICKBART)) {
      const q = (n as Element).getBoundingClientRect();
      if (q.width && q.height && !utanfor(q)) return true;
    }
  }
  return false;
}

/** Platserna kring ordet t för en anteckning som är w gånger h, med pilens början och slut. Samma som anteckningarna alltid haft. */
function forslag(p: Plats, t: Ruta, w: number, h: number): { x: number; y: number; s: Punkt; e: Punkt } {
  const tw = t.r - t.l;
  const th = t.b - t.t;
  if (p === "over-snett") {
    const x = t.l + tw * 0.55;
    const y = t.t - h - 40;
    return { x, y, s: [x - 6, y + h * 0.7], e: [t.l + tw * 0.42, t.t - 5] };
  }
  if (p === "over-hoger") {
    const x = t.r + 26;
    const y = t.t - h - 10;
    return { x, y, s: [x - 6, y + h * 0.72], e: [t.r - Math.min(tw * 0.3, 18), t.t - 3] };
  }
  if (p === "hoger") {
    const x = t.r + 44;
    const y = t.t + th / 2 - h / 2 - 4;
    return { x, y, s: [x - 8, y + h * 0.62], e: [t.r + 8, t.t + th / 2] };
  }
  const x = t.l + tw / 2 - w / 2 + 14;
  const y = t.t - h - 26;
  return { x, y, s: [x + w / 2 - 14, y + h + 2], e: [t.l + tw / 2, t.t - 4] };
}

/** Pilen från en anteckning som lagts för hand: från kanten närmast ordet till ordets sida mot anteckningen. */
export function pilMellan(box: Ruta, t: Ruta): { s: Punkt; e: Punkt } {
  const mx = (box.l + box.r) / 2;
  const ty = (t.t + t.b) / 2;
  const e: Punkt =
    box.b <= t.t ? [klamra(mx, t.l + 4, t.r - 4), t.t - 4] : box.t >= t.b ? [klamra(mx, t.l + 4, t.r - 4), t.b + 4] : box.l >= t.r ? [t.r + 6, ty] : [t.l - 6, ty];
  return { s: pilStart(box, e), e };
}

/** Där pilen lämnar anteckningen på väg mot punkten e. */
export const pilStart = (box: Ruta, e: Punkt): Punkt => [klamra(e[0], box.l - 6, box.r + 6), klamra(e[1], box.t - 4, box.b + 6)];

/** Pilen: en båge från start till slut som buktar uppåt, och ett pilhuvud i bågens riktning. */
export function pilVag([sx, sy]: Punkt, [ex, ey]: Punkt) {
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

/**
 * Var anteckningen ska stå. lager är lagret och rot sidan (main), w och h anteckningens storlek och fore rutorna runt anteckningarna
 * före den i listan. För besökare: där den lades om den får plats där, annars första platsen kring ordet som är fri, annars
 * ingenstans. I redigeringsläget står den där den lades ändå.
 */
function placera(a: Anteckning, lager: HTMLElement, rot: HTMLElement, w: number, h: number, redigerar: boolean, fore: DOMRect[]): Lage | null {
  if (!w || !h) return null;
  const range = document.createRange();
  const c = lager.getBoundingClientRect();
  const sid = rot.getBoundingClientRect();
  const minT = huvudHojd() + 6 - (c.top + window.scrollY);
  const q = hittaMal(rot, a.mal, a.nr ?? 0, range);
  if (!q) {
    if (!redigerar) return null;
    const box = ruta(sid.left - c.left + 24, Math.max(minT, sid.top - c.top) + 24, w, h);
    return { box, mal: null, s: [box.l, box.b], e: [box.l, box.b], syns: "saknas" };
  }
  const t: Ruta = { l: q.left - c.left, t: q.top - c.top, r: q.right - c.left, b: q.bottom - c.top };
  const [vl, vr, vb] = [sid.left - c.left + 6, sid.right - c.left - 6, c.height - 4];
  const fri = (x: number, y: number) => {
    const ram = { l: x - 8, t: y - 8, r: x + w + 8, b: y + h + 8 };
    if (ram.l < vl || ram.r > vr || ram.t < minT || ram.b > vb) return false;
    const v = { l: ram.l + c.left, t: ram.t + c.top, r: ram.r + c.left, b: ram.b + c.top };
    if (fore.some((q) => q.left < v.r && q.right > v.l && q.top < v.b && q.bottom > v.t)) return false;
    return !krockar(rot, v, range);
  };
  const lagd = a.x !== undefined && a.y !== undefined ? { x: t.l + a.x, y: t.t + a.y } : null;
  const lagdFri = !!lagd && fri(lagd.x, lagd.y);
  const platser = a.mal.trim() ? VID_ORD : VID_RUBRIK;
  const auto = lagdFri ? null : (platser.map((p) => forslag(p, t, w, h)).find((f) => fri(f.x, f.y)) ?? null);
  if (lagd && (lagdFri || redigerar)) {
    const box = ruta(lagd.x, lagd.y, w, h);
    return { box, mal: t, ...pilMellan(box, t), syns: lagdFri ? "har" : auto ? "annan" : "inte" };
  }
  if (auto) return { box: ruta(auto.x, auto.y, w, h), mal: t, s: auto.s, e: auto.e, syns: "har" };
  if (!redigerar) return null;
  const f = forslag(platser[0], t, w, h);
  return { box: ruta(f.x, f.y, w, h), mal: t, s: f.s, e: f.e, syns: "inte" };
}

/** En anteckning medan den dras i redigeringsläget: förflyttningen, eller pilens spets där pekaren är. */
export type Drag = { dx: number; dy: number } | { spets: Punkt };

/** Läget när anteckningen eller pilens spets dras, med pilen räknad på nytt. */
function dragen(lage: Lage, drag: Drag | null): Lage {
  if (!drag) return lage;
  if ("spets" in drag) return { ...lage, s: pilStart(lage.box, drag.spets), e: drag.spets };
  const box = { l: lage.box.l + drag.dx, t: lage.box.t + drag.dy, r: lage.box.r + drag.dx, b: lage.box.b + drag.dy };
  return { ...lage, box, ...(lage.mal ? pilMellan(box, lage.mal) : { s: [box.l, box.b] as Punkt, e: [box.l, box.b] as Punkt }) };
}

function Lapp({
  a,
  nr,
  sida,
  redigerar,
  oppnas,
  onOppnad,
  onAndra,
}: {
  a: Anteckning;
  /** Platsen i listan. Anteckningen hamnar inte ovanpå dem som står före den. */
  nr: number;
  sida: string;
  redigerar: boolean;
  oppnas: boolean;
  onOppnad: () => void;
  onAndra: (nytt: Anteckning | null) => void;
}) {
  const { ord, slut } = forbered(a.text, 0, PER_TECKEN, PAUS);
  const ref = useSkrivning<HTMLDivElement>(`anteckning:${sida}:${a.text}`, a.text, redigerar, FORDROJNING, slut + PIL + HUVUD + 200);
  const text = useRef<HTMLSpanElement>(null);
  const [lage, setLageRa] = useState<Lage | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const span = text.current;
    const lager = el?.parentElement;
    const rot = document.getElementById("innehall");
    if (!el || !span || !lager || !rot) return;
    let raf = 0;
    // Samma läge som förut ger ingen ny rendering, så att mätningen inte går runt i en slinga.
    const berakna = () => {
      raf = 0;
      // Anteckningarna före den i listan har fått sina platser först, så den här undviker dem och inte tvärtom.
      const fore = [...lager.querySelectorAll<HTMLElement>(":scope > .anteckning-lapp")]
        .filter((e) => Number(e.dataset.nr) < nr && e.style.visibility !== "hidden")
        .map((e) => e.getBoundingClientRect());
      const ny = placera(a, lager, rot, span.offsetWidth, span.offsetHeight, redigerar, fore);
      setLageRa((gammal) => (JSON.stringify(gammal) === JSON.stringify(ny) ? gammal : ny));
    };
    berakna();
    const igen = () => {
      if (!raf) raf = requestAnimationFrame(berakna);
    };
    // Om igen när sidan ändrar storlek (innehåll som strömmas in, en annan bredd) och när typsnittet har kommit.
    const ro = new ResizeObserver(igen);
    ro.observe(rot);
    ro.observe(span);
    document.fonts.addEventListener("loadingdone", igen);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.fonts.removeEventListener("loadingdone", igen);
    };
  }, [ref, a, nr, redigerar]);

  const visas = lage ? dragen(lage, drag) : null;
  // Pilen ritas i anteckningens koordinater, från dess övre vänstra hörn.
  const vag = visas && (visas.mal || (drag && "spets" in drag)) ? pilVag([visas.s[0] - visas.box.l, visas.s[1] - visas.box.t], [visas.e[0] - visas.box.l, visas.e[1] - visas.box.t]) : null;
  return (
    <div
      ref={ref}
      className={a.rod ? "handskrift anteckning-lapp hs-rod" : "handskrift anteckning-lapp"}
      data-nr={nr}
      // Utan läge står den långt utanför sidan, så att den inte räknas som synlig och skrivs fram innan den har en plats.
      style={visas ? { left: visas.box.l, top: visas.box.t } : { left: -10000, top: 0, visibility: "hidden" }}
      data-syns={redigerar && visas ? visas.syns : undefined}
    >
      <span ref={text} className="anteckning-text">
        <Orden ord={ord} />
      </span>
      {vag && (
        <svg aria-hidden className="hs-ritning anteckning-pil" strokeWidth={1.8}>
          <path pathLength={1} d={vag.pil} style={{ "--rd": slut + 120, "--rt": PIL } as CSSProperties} />
          <path pathLength={1} d={vag.huvud} style={{ "--rd": slut + 120 + PIL, "--rt": HUVUD } as CSSProperties} />
        </svg>
      )}
      {redigerar && visas && (
        <Suspense fallback={null}>
          <Redigerare a={a} lage={visas} lapp={ref} oppnas={oppnas} onOppnad={onOppnad} onDrag={setDrag} onAndra={onAndra} />
        </Suspense>
      )}
    </div>
  );
}

/** Lagret med sidans anteckningar. server är blocket som servern läste. */
export function AnteckningLager({ server }: { server: Anteckningar }) {
  const { varde, aktiv, andra } = useBlock("b:anteckningar", server);
  const sida = usePathname();
  // Den nya anteckningen vars ruta ska öppnas när den har fått en plats.
  const [oppna, setOppna] = useState<number | null>(null);
  const pa = varde.lista.flatMap((a, i) => (a.sida === sida ? [{ a, i }] : []));
  if (!pa.length && !aktiv) return null;
  return (
    <div className="anteckningar" aria-hidden={aktiv ? undefined : true}>
      {pa.map(({ a, i }) => (
        <Lapp
          key={`${sida}:${i}`}
          a={a}
          nr={i}
          sida={sida}
          redigerar={aktiv}
          oppnas={oppna === i}
          onOppnad={() => setOppna(null)}
          onAndra={(nytt) =>
            andra((b) => {
              if (nytt) b.lista[i] = nytt;
              else b.lista.splice(i, 1);
            })
          }
        />
      ))}
      {aktiv && (
        <Suspense fallback={null}>
          <NyKnapp
            kan={varde.lista.length < 40}
            onNy={() => {
              setOppna(varde.lista.length);
              andra((b) => {
                b.lista.push({ sida, text: "(ny anteckning)", mal: "" });
              });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
