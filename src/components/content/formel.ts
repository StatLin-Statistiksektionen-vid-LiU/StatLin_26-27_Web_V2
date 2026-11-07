/*
 * Formler i LaTeX skrivna för hand i Mynerve: rutnätets formler (RutnatLjus) och förhandsvisningen i redigeringsläget. latex.ts tolkar
 * formeln, och här läggs den ut ungefär som i TeX: index och exponenter, bråk, rötter, gränser under och över summor, parenteser som
 * växer och mellanrummen kring = och +. Allt mäts i em av formelns storlek, från baslinjen och med y nedåt.
 *
 * Varje löv är ett ord i typsnittet eller några streck som ritas för hand (formel-tecken.ts), med en tid i den ordning man skriver:
 * täljaren, bråkstrecket och nämnaren, roten före det som står under den, bokstaven före strecket över den. formel-vy.tsx gör löven
 * till element, och handstilens CSS skriver fram dem (data-skriv).
 *
 * Laddas först när den behövs, eftersom den mäter med canvas och bara körs i webbläsaren.
 */

import { tolkaLatex, type Klass, type Nod } from "@/lib/latex";
import { ACCENTER, avgransare, storaTecken, strackLangd, TECKEN, type Ritat } from "./formel-tecken";

export type Streck = { d: string; rd: number; rt: number };
export type Prick = { x: number; y: number; rd: number };
/** Ett ord med baslinjen på y, eller en ruta med streck vars överkant är y. k är storleken mot formelns, och strecken mäts i hundradels k em. */
export type Lov =
  | { typ: "text"; s: string; x: number; y: number; k: number; d: number; t: number; rod?: boolean; bf?: boolean; bb?: boolean }
  | { typ: "rit"; x: number; y: number; w: number; h: number; k: number; streck: Streck[]; prickar: Prick[]; sw: number; rod?: boolean };
/** w bred, h över baslinjen och d under. fore och efter är klassen i kanterna, som avgör mellanrummet mot grannarna. */
export type Ruta = { w: number; h: number; d: number; lov: Lov[]; fore: Klass; efter: Klass; rum?: boolean };
export type Ritad = { ruta: Ruta; slut: number; okanda: string[]; fel: string[] };

/* ---------- Mått ---------- */

const TYPSNITT = '100px Mynerve, "Mynerve Reserv Arial", sans-serif';
/** Tecken ur alla delar av typsnittet som formlerna använder, så att de laddas innan något mäts. */
const PROV = "AaXx019()[]{}|+−=<>,.:;'!?±×÷·¬αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ";

type Matt = { w: number; h: number; d: number };
const matt = new Map<string, Matt>();
let matare: CanvasRenderingContext2D | null | undefined;

/** Bredd och bläckets höjd och djup för texten i Mynerve, i em. */
function mat(s: string): Matt {
  const sparat = matt.get(s);
  if (sparat) return sparat;
  matare ??= typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  let m: Matt;
  if (!matare) m = { w: [...s].length * 0.5, h: 0.7, d: 0.1 };
  else {
    matare.font = TYPSNITT;
    const t = matare.measureText(s);
    m = { w: t.width / 100, h: Math.max(0, t.actualBoundingBoxAscent / 100), d: Math.max(0, t.actualBoundingBoxDescent / 100) };
  }
  matt.set(s, m);
  return m;
}

let laddat: Promise<void> | null = null;
/** Hämtar Mynerve, med grekiskan, och mäter om allt därefter. */
export function laddaTypsnitt(): Promise<void> {
  laddat ??= document.fonts.load('24px "Mynerve"', PROV).then(
    () => matt.clear(),
    (e) => {
      laddat = null;
      throw e;
    },
  );
  return laddat;
}

/* ---------- Pennan ---------- */

/** Pennan lyfts så länge mellan två ord eller streck. */
const LYFT = 30;

/** Håller reda på tiden medan formeln läggs ut, i den ordning man skriver. */
class Penna {
  tid = 0;
  constructor(private perTecken: number) {}
  text(s: string, k: number) {
    const d = this.tid;
    const t = Math.round([...s.replace(/\s/g, "")].length * this.perTecken * Math.min(1.5, Math.max(0.85, k)));
    this.tid += t + LYFT;
    return { d, t };
  }
  /** Ett streck som är langd em långt. */
  streck(langd: number) {
    const rd = this.tid;
    const rt = Math.round(Math.max(60, 70 + langd * 120));
    this.tid += rt + LYFT;
    return { rd, rt };
  }
  /** En tid för något som ritas nu men mäts först senare, som bråkstrecket före nämnaren. */
  reservera(ms: number) {
    const rd = this.tid;
    this.tid += ms + LYFT;
    return { rd, rt: ms };
  }
  paus(ms: number) {
    this.tid += ms;
  }
}

/* ---------- Stilar och mellanrum ---------- */

type Ctx = { stil: number; rod: boolean; bf: boolean; bb: boolean };
/** Stilarna i TeX: 0 display, 1 text, 2 index och 3 index i index. Deras storlek, och stilen för index och för bråkets delar. */
const SKALA = [1, 1, 0.7, 0.55];
const SKRIPT = [2, 2, 3, 3];
const BRAK = [1, 2, 3, 3];
/** Axeln, mitten på − och =, över baslinjen, och strecktjockleken: Mynerves, i em och i hundradels em. */
const AXEL = 0.29;
const TJOCK = 0.065;
const SW = 6.5;

const KLASSER: Klass[] = ["ord", "op", "bin", "rel", "open", "close", "punct", "inner"];
/** Mellanrummet mellan två klasser som i TeX: 1 litet, 2 mellan och 3 stort. Negativt gäller bara i display och text. */
const MELLAN = [
  [0, 1, -2, -3, 0, 0, 0, -1],
  [1, 1, 0, -3, 0, 0, 0, -1],
  [-2, -2, 0, 0, -2, 0, 0, -2],
  [-3, -3, 0, 0, -3, 0, 0, -3],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, -2, -3, 0, 0, 0, -1],
  [-1, -1, 0, -1, -1, -1, -1, -1],
  [-1, 1, -2, -3, -1, 0, -1, -1],
];
const MU = [0, 0.17, 0.24, 0.3];
function mellanrum(a: Klass, b: Klass, stil: number) {
  const v = MELLAN[KLASSER.indexOf(a)][KLASSER.indexOf(b)];
  return v < 0 && stil > 1 ? 0 : MU[Math.abs(v)];
}

const tomRuta = (): Ruta => ({ w: 0, h: 0, d: 0, lov: [], fore: "ord", efter: "ord" });
const flytta = (lov: Lov[], dx: number, dy: number): Lov[] => lov.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }));
const flaggor = (c: Ctx) => ({ ...(c.rod && { rod: true }), ...(c.bf && { bf: true }), ...(c.bb && { bb: true }) });
const medStil = (c: Ctx, stil: number): Ctx => ({ ...c, stil });
/** Baserna för hundradels em i ett löv av storleken k. */
const hu = (v: number, k: number) => Math.round((v / k) * 1000) / 10;

/* ---------- Löv ---------- */

function textRuta(s: string, c: Ctx, p: Penna, klass: Klass, k = SKALA[c.stil]): Ruta {
  if (!s) return { ...tomRuta(), fore: klass, efter: klass };
  const m = mat(s);
  const { d, t } = p.text(s, k);
  return { w: m.w * k, h: m.h * k, d: m.d * k, lov: [{ typ: "text", s, x: 0, y: 0, k, d, t, ...flaggor(c) }], fore: klass, efter: klass };
}

/** Lägsta och högsta y i strecken, ungefär (kontrollpunkterna räknas med). */
function yGranser(r: { p: string[]; prickar?: [number, number][] }) {
  let min = Infinity;
  let max = -Infinity;
  for (const d of r.p) {
    const tal = d.match(/-?\d*\.?\d+/g) ?? [];
    for (let i = 1; i < tal.length; i += 2) {
      min = Math.min(min, +tal[i]);
      max = Math.max(max, +tal[i]);
    }
  }
  for (const [, y] of r.prickar ?? []) {
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  return min <= max ? { min, max } : { min: 77.5, max: 77.5 };
}

const prickar = (lista: [number, number][] | undefined, p: Penna): Prick[] => (lista ?? []).map(([x, y]) => ({ x, y, rd: p.reservera(50).rd }));

/** Ett tecken som ritas för hand, i en ruta som täcker raden: y = 0 är 0,775 em över baslinjen. */
function ritTecken(r: Ritat, c: Ctx, p: Penna, klass: Klass): Ruta {
  const k = SKALA[c.stil];
  const { min, max } = yGranser(r);
  const streck = r.p.map((d) => ({ d, ...p.streck((strackLangd(d) / 100) * k) }));
  const w = (r.w / 100) * k;
  return {
    w,
    h: Math.max(0, ((77.5 - min + SW / 2) / 100) * k),
    d: Math.max(0, ((max - 77.5 + SW / 2) / 100) * k),
    lov: [{ typ: "rit", x: 0, y: -0.775 * k, w, h: k, k, streck, prickar: prickar(r.prickar, p), sw: c.bf ? SW * 1.4 : SW, ...(c.rod && { rod: true }) }],
    fore: klass,
    efter: klass,
  };
}

/** Ett streck för hand från (x0, y0) till (x1, y1), något böjt. */
function linje(x0: number, y0: number, x1: number, y1: number, k: number, tid: { rd: number; rt: number }, c: Ctx): Lov {
  const m = 0.1 * k;
  const bx = Math.min(x0, x1) - m;
  const by = Math.min(y0, y1) - m;
  const [ax, ay, ex, ey] = [hu(x0 - bx, k), hu(y0 - by, k), hu(x1 - bx, k), hu(y1 - by, k)];
  const d = `M ${ax} ${ay} Q ${Math.round(((ax + ex) / 2) * 10) / 10} ${Math.round(((ay + ey) / 2 + 0.9) * 10) / 10} ${ex} ${ey}`;
  return { typ: "rit", x: bx, y: by, w: Math.abs(x1 - x0) + 2 * m, h: Math.abs(y1 - y0) + 2 * m, k, streck: [{ d, ...tid }], prickar: [], sw: c.bf ? SW * 1.4 : SW, ...(c.rod && { rod: true }) };
}

/** En ruta med streck i hundradels k em, från (x, y) i em. */
function ritLov(x: number, y: number, w: number, h: number, k: number, streck: Streck[], c: Ctx, pr: Prick[] = []): Lov {
  return { typ: "rit", x, y, w, h, k, streck, prickar: pr, sw: c.bf ? SW * 1.4 : SW, ...(c.rod && { rod: true }) };
}

/* ---------- Klasser ---------- */

function klassAv(n: Nod): [Klass, Klass] | null {
  switch (n.t) {
    case "tecken":
    case "delim":
      return [n.k, n.k];
    case "rum":
      return null;
    case "skript":
      return (n.bas && klassAv(n.bas)) ?? ["ord", "ord"];
    case "brak":
    case "tabell":
      return ["inner", "inner"];
    case "accent":
      return n.typ === "inte" ? (klassAv(n.inne) ?? ["ord", "ord"]) : ["ord", "ord"];
    case "stor":
    case "funk":
      return ["op", "op"];
    case "avgr":
      return [n.kv, n.kh];
    case "stil":
      return klassAv(n.inne);
    case "stapla":
      return klassAv(n.bas) ?? ["ord", "ord"];
    default:
      return ["ord", "ord"];
  }
}

/* ---------- Listor ---------- */

type Del = Nod | { t: "ord"; s: string };

function lista(noder: Nod[], c: Ctx, p: Penna): Ruta {
  // Vanliga tecken i följd, som SS, 1,96 och xy, skrivs som ett ord.
  const delar: Del[] = [];
  for (const n of noder) {
    const sista = delar.at(-1);
    if (n.t === "tecken" && n.k === "ord" && !n.s.startsWith("@")) {
      if (sista?.t === "ord") sista.s += n.s;
      else delar.push({ t: "ord", s: n.s });
    } else delar.push(n);
  }

  // Ett + eller − först, efter en relation eller öppnande parentes blir ett förtecken, som i TeX.
  const kl = delar.map((n) => (n.t === "ord" ? (["ord", "ord"] as [Klass, Klass]) : klassAv(n)));
  const utanBin = (k: [Klass, Klass]): [Klass, Klass] => [k[0] === "bin" ? "ord" : k[0], k[1] === "bin" ? "ord" : k[1]];
  let forra = -1;
  for (let i = 0; i < kl.length; i++) {
    const k = kl[i];
    if (!k) continue;
    const f = forra >= 0 ? kl[forra]![1] : null;
    if (k[0] === "bin" && (!f || f === "bin" || f === "op" || f === "rel" || f === "open" || f === "punct")) kl[i] = utanBin(k);
    if ((k[0] === "rel" || k[0] === "close" || k[0] === "punct") && f === "bin") kl[forra] = utanBin(kl[forra]!);
    forra = i;
  }
  if (forra >= 0 && kl[forra]![1] === "bin") kl[forra] = utanBin(kl[forra]!);

  let x = 0;
  let h = 0;
  let d = 0;
  const lov: Lov[] = [];
  let efter: Klass | null = null;
  let fore: Klass | null = null;
  for (let i = 0; i < delar.length; i++) {
    const n = delar[i];
    const k = kl[i];
    if (k && efter) x += mellanrum(efter, k[0], c.stil);
    if (k?.[0] === "rel") p.paus(50);
    const r = n.t === "ord" ? textRuta(n.s, c, p, "ord") : nod(n, c, p);
    lov.push(...flytta(r.lov, x, 0));
    h = Math.max(h, r.h);
    d = Math.max(d, r.d);
    x += r.w;
    if (k) {
      fore ??= k[0];
      efter = k[1];
      if (k[1] === "rel" || k[1] === "punct") p.paus(30);
    }
  }
  return { w: x, h, d, lov, fore: fore ?? "ord", efter: efter ?? "ord" };
}

function nod(n: Nod, c: Ctx, p: Penna): Ruta {
  switch (n.t) {
    case "tecken":
      return tecken(n.s, n.k, c, p);
    case "text":
      return textRuta(n.s, c, p, "ord");
    case "grupp":
      return { ...lista(n.barn, c, p), fore: "ord", efter: "ord" };
    case "skript":
      return skript(n, c, p);
    case "brak":
      return brak(n, c, p);
    case "rot":
      return rot(n, c, p);
    case "accent":
      return accent(n, c, p);
    case "stor":
      return stor(n.s, c, p);
    case "funk":
      return textRuta(n.namn, c, p, "op");
    case "avgr":
      return avgr(n, c, p);
    case "delim":
      return delim(n, c, p);
    case "rum":
      return { ...tomRuta(), w: n.em * SKALA[c.stil], rum: true };
    case "stil":
      return nod(n.inne, { ...c, [n.stil]: true }, p);
    case "tabell":
      return tabell(n, c, p);
    case "stapla": {
      const b = nod(n.bas, c, p);
      const ss = medStil(c, SKRIPT[c.stil]);
      const o = n.over ? nod(n.over, ss, p) : null;
      const u = n.under ? nod(n.under, ss, p) : null;
      return stapel(b, o, u, SKALA[c.stil]);
    }
  }
}

function tecken(s: string, k: Klass, c: Ctx, p: Penna): Ruta {
  if (s.startsWith("@")) {
    const r = TECKEN[s.slice(1)];
    return r ? ritTecken(r, c, p, k) : textRuta(s.slice(1), c, p, k);
  }
  return textRuta(s === "…" ? "..." : s, c, p, k);
}

/* ---------- Index, exponenter och gränser ---------- */

/** Basen i mitten och gränserna centrerade över och under, som under en summa. */
function stapel(b: Ruta, o: Ruta | null, u: Ruta | null, sk: number): Ruta {
  const gap = 0.14 * sk;
  const w = Math.max(b.w, o?.w ?? 0, u?.w ?? 0);
  const lov = flytta(b.lov, (w - b.w) / 2, 0);
  let h = b.h;
  let d = b.d;
  if (o) {
    lov.push(...flytta(o.lov, (w - o.w) / 2, -(b.h + gap + o.d)));
    h = b.h + gap + o.d + o.h;
  }
  if (u) {
    lov.push(...flytta(u.lov, (w - u.w) / 2, b.d + gap + u.h));
    d = b.d + gap + u.h + u.d;
  }
  return { w, h, d, lov, fore: b.fore, efter: b.efter };
}

const arIntegral = (s: string) => /^@(i*int|oint)$/.test(s);

function skript(n: Extract<Nod, { t: "skript" }>, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  const bas = n.bas;
  // Gränserna står under och över summor och produkter i display, liksom under lim och max, och under allt med \limits.
  const granser = bas?.t === "stor" ? (bas.granser ?? (c.stil === 0 && !arIntegral(bas.s))) : bas?.t === "funk" ? bas.granser && c.stil === 0 : false;
  const b = bas ? nod(bas, c, p) : tomRuta();

  // Ett primtecken utan index skrivs i full storlek direkt efter, som f'.
  if (!granser && !n.ned && n.upp?.t === "tecken" && /^'+$/.test(n.upp.s)) {
    const pr = textRuta(n.upp.s, c, p, "ord");
    return { w: b.w + pr.w, h: Math.max(b.h, pr.h), d: b.d, lov: [...b.lov, ...flytta(pr.lov, b.w, 0)], fore: b.fore, efter: b.efter };
  }

  const ss = medStil(c, SKRIPT[c.stil]);
  let o: Ruta | null = null;
  let u: Ruta | null = null;
  for (const del of n.uppForst ? [n.upp, n.ned] : [n.ned, n.upp]) {
    if (!del) continue;
    const r = nod(del, ss, p);
    if (del === n.upp) o = r;
    else u = r;
  }
  if (granser) return stapel(b, o, u, sk);

  const upp = Math.max(0.4 * sk, b.h - 0.24 * sk, (o?.d ?? 0) + 0.2 * sk);
  let ner = Math.max(o && u ? 0.26 * sk : 0.2 * sk, 0.7 * b.d + 0.05 * sk, (u?.h ?? 0) - 0.36 * sk);
  if (o && u) {
    const glapp = upp - o.d - (u.h - ner);
    if (glapp < 0.12 * sk) ner += 0.12 * sk - glapp;
  }
  const x = b.w + 0.02 * sk;
  // Under en integral står gränsen närmare stammen.
  const xNed = bas?.t === "stor" && arIntegral(bas.s) ? b.w - 0.2 * sk : x;
  const lov = [...b.lov];
  if (o) lov.push(...flytta(o.lov, x, -upp));
  if (u) lov.push(...flytta(u.lov, xNed, ner));
  return {
    w: Math.max(x + (o?.w ?? 0), xNed + (u?.w ?? 0)) + 0.04 * sk,
    h: Math.max(b.h, o ? upp + o.h : 0),
    d: Math.max(b.d, u ? ner + u.d : 0),
    lov,
    fore: b.fore,
    efter: b.efter,
  };
}

/* ---------- Bråk och rötter ---------- */

function brak(n: Extract<Nod, { t: "brak" }>, c: Ctx, p: Penna): Ruta {
  const egen = n.stil === "d" ? 0 : n.stil === "t" ? 1 : c.stil;
  const fk = SKALA[egen];
  const inre = medStil(c, BRAK[egen]);
  const pad = 0.1 * fk;
  const kant = 0.06 * fk;
  const gap = (egen === 0 ? 0.17 : 0.11) * fk;
  const a = AXEL * fk;
  const halv = n.streck ? (TJOCK / 2) * fk : 0.12 * fk;
  const tal = nod(n.tal, inre, p);
  const strecket = n.streck ? p.reservera(Math.round(90 + (tal.w + 2 * pad) * 110)) : null;
  const nam = nod(n.nam, inre, p);
  const w = Math.max(tal.w, nam.w) + 2 * pad;
  const lov = [...flytta(tal.lov, kant + (w - tal.w) / 2, -(a + halv + gap + tal.d)), ...flytta(nam.lov, kant + (w - nam.w) / 2, -a + halv + gap + nam.h)];
  if (strecket) lov.push(linje(kant + 0.02 * fk, -a + 0.012 * fk, kant + w - 0.02 * fk, -a - 0.018 * fk, fk, strecket, c));
  return { w: w + 2 * kant, h: a + halv + gap + tal.d + tal.h, d: Math.max(0, -a + halv + gap + nam.h + nam.d), lov, fore: "inner", efter: "inner" };
}

function rot(n: Extract<Nod, { t: "rot" }>, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  const tomt = (x: Nod | null) => !x || (x.t === "grupp" && x.barn.length === 0);
  const idx = tomt(n.index) ? null : nod(n.index!, medStil(c, 3), p);
  const hake = p.reservera(220);
  const inne = nod(n.inne, c, p);
  const topp = Math.max(inne.h, 0.5 * sk) + 0.14 * sk;
  const botten = inne.d + 0.06 * sk;
  const H = topp + botten;
  const bw = (0.45 + 0.08 * Math.max(0, H / sk - 1)) * sk;
  const dx = idx ? Math.max(0, idx.w - 0.5 * bw) : 0;
  const m = 0.1 * sk;
  // Haken: ett litet streck upp, ner till botten och upp till toppen, i en ruta med marginal runt.
  const bx = dx - m;
  const by = -topp - m;
  const pt = (x: number, y: number) => `${hu(x - bx, sk)} ${hu(y - by, sk)}`;
  const d = `M ${pt(dx, botten - 0.4 * H)} L ${pt(dx + 0.2 * bw, botten - 0.47 * H)} L ${pt(dx + 0.48 * bw, botten)} L ${pt(dx + bw, -topp)}`;
  const lov: Lov[] = [];
  if (idx) lov.push(...flytta(idx.lov, dx + 0.55 * bw - idx.w, botten - 0.55 * H - idx.d));
  lov.push(ritLov(bx, by, bw + 2 * m, H + 2 * m, sk, [{ d, ...hake }], c));
  const xInne = dx + bw + 0.08 * sk;
  lov.push(...flytta(inne.lov, xInne, 0));
  const w = xInne + inne.w + 0.08 * sk;
  lov.push(linje(dx + bw, -topp, w, -topp - 0.012 * sk, sk, p.streck(w - dx - bw), c));
  return {
    w: w + 0.04 * sk,
    h: Math.max(topp + TJOCK * sk, idx ? -(botten - 0.55 * H - idx.d) + idx.h : 0),
    d: botten + 0.02 * sk,
    lov,
    fore: "ord",
    efter: "ord",
  };
}

/* ---------- Accenter ---------- */

function accent(n: Extract<Nod, { t: "accent" }>, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  const inne = nod(n.inne, c, p);
  const lov = [...inne.lov];
  let h = inne.h;
  let d = inne.d;
  const topp = Math.max(inne.h, 0.47 * sk);
  // Handstilen lutar lite, så det som står över en bokstav hamnar en aning åt höger.
  const lut = inne.w < 0.8 * sk ? 0.04 * sk : 0;
  const klass: [Klass, Klass] = n.typ === "inte" ? [inne.fore, inne.efter] : ["ord", "ord"];
  switch (n.typ) {
    case "bar": {
      const y = -(topp + 0.12 * sk);
      const x0 = 0.05 * sk + lut;
      const x1 = Math.max(inne.w - 0.02 * sk + lut, x0 + 0.3 * sk);
      lov.push(linje(x0, y + 0.01 * sk, x1, y - 0.015 * sk, sk, p.streck(x1 - x0), c));
      h = Math.max(h, -y + 0.015 * sk + TJOCK * sk);
      break;
    }
    case "under": {
      const y = inne.d + 0.12 * sk;
      const x1 = Math.max(inne.w - 0.02 * sk, 0.32 * sk);
      lov.push(linje(0.02 * sk, y, x1, y - 0.02 * sk, sk, p.streck(x1), c));
      d = Math.max(d, y + TJOCK * sk);
      break;
    }
    case "inte": {
      const x0 = inne.w * 0.3;
      const x1 = inne.w * 0.7;
      lov.push(linje(x0, inne.d + 0.1 * sk, x1, -(inne.h + 0.1 * sk), sk, p.streck(inne.h + inne.d + 0.2 * sk), c));
      h = inne.h + 0.12 * sk;
      d = inne.d + 0.12 * sk;
      break;
    }
    default: {
      // hat, tilde, check och vec breddas med innehållet, prickarna står som de är.
      const a = ACCENTER[n.typ];
      const W = n.typ === "dot" || n.typ === "ddot" ? a.w : Math.max(a.w, Math.round(((inne.w / sk) * 100 - 4) * 0.92));
      const p0 =
        n.typ === "hat"
          ? [`M 6 15 L ${W / 2} 3 L ${W - 6} 15`]
          : n.typ === "check"
            ? [`M 6 3 L ${W / 2} 13 L ${W - 6} 3`]
            : n.typ === "tilde"
              ? [`M 5 10 C ${W * 0.22} 2 ${W * 0.36} 2 ${W / 2} 7 C ${W * 0.64} 12 ${W * 0.78} 12 ${W - 5} 4`]
              : n.typ === "vec"
                ? [`M 3 9 L ${W - 3} 9`, `M ${W - 12} 3 L ${W - 3} 9 L ${W - 12} 15`]
                : a.p;
      const ww = (W / 100) * sk;
      const hh = (a.h / 100) * sk;
      const y = -(topp + 0.07 * sk + hh);
      const streck = p0.map((dd) => ({ d: dd, ...p.streck((strackLangd(dd) / 100) * sk) }));
      lov.push(ritLov((inne.w - ww) / 2 + lut, y, ww, hh, sk, streck, c, prickar("prickar" in a ? a.prickar : undefined, p)));
      h = Math.max(h, -y);
    }
  }
  return { w: inne.w, h, d, lov, fore: klass[0], efter: klass[1] };
}

/* ---------- Stora tecken och parenteser ---------- */

/** Σ och Π ur typsnittet, större i display, och integraler och stora ∪ ritade för hand. Mitt på axeln. */
function stor(s: string, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  const a = AXEL * sk;
  if (!s.startsWith("@")) {
    const k = (c.stil === 0 ? 1.5 : 1.15) * sk;
    const m = mat(s);
    const { d, t } = p.text(s, k);
    const halv = ((m.h + m.d) / 2) * k;
    return { w: m.w * k, h: a + halv, d: Math.max(0, halv - a), lov: [{ typ: "text", s, x: 0, y: ((m.h - m.d) / 2) * k - a, k, d, t, ...flaggor(c) }], fore: "op", efter: "op" };
  }
  const hojd = c.stil === 0 ? 190 : 135;
  const r = storaTecken(s.slice(1), hojd);
  if (!r) return textRuta(s.slice(1), c, p, "op");
  const H = (hojd / 100) * sk;
  const streck = r.p.map((d) => ({ d, ...p.streck((strackLangd(d) / 100) * sk) }));
  return { w: (r.w / 100) * sk, h: a + H / 2, d: Math.max(0, H / 2 - a), lov: [ritLov(0, -(a + H / 2), (r.w / 100) * sk, H, sk, streck, c)], fore: "op", efter: "op" };
}

/** Avgränsarna som typsnittet har. De andra, och alla som måste vara större än en rad, ritas för hand. */
const GLYF = new Set(["(", ")", "[", "]", "{", "}", "|", "/"]);

/** En avgränsare som är 2 × halv hög mitt på axeln, eller tecknet ur typsnittet om innehållet ryms i en rad. */
function avgransareRuta(s: string, halv: number, ryms: boolean, tid: { rd: number; rt: number }, c: Ctx): Ruta | null {
  if (s === ".") return null;
  const sk = SKALA[c.stil];
  const a = AXEL * sk;
  if (ryms && GLYF.has(s)) {
    const m = mat(s);
    return { w: m.w * sk, h: m.h * sk, d: m.d * sk, lov: [{ typ: "text", s, x: 0, y: 0, k: sk, d: tid.rd, t: tid.rt, ...flaggor(c) }], fore: "ord", efter: "ord" };
  }
  const r = avgransare(s, Math.round(((2 * halv) / sk) * 100));
  if (!r) {
    const m = mat(s);
    return { w: m.w * sk, h: m.h * sk, d: m.d * sk, lov: [{ typ: "text", s, x: 0, y: 0, k: sk, d: tid.rd, t: tid.rt, ...flaggor(c) }], fore: "ord", efter: "ord" };
  }
  const del = tid.rt / r.p.length;
  const streck = r.p.map((d, i) => ({ d, rd: Math.round(tid.rd + i * del), rt: Math.round(del) }));
  const w = (r.w / 100) * sk;
  return { w, h: a + halv, d: Math.max(0, halv - a), lov: [ritLov(0, -(a + halv), w, 2 * halv, sk, streck, c)], fore: "ord", efter: "ord" };
}

function avgr(n: Extract<Nod, { t: "avgr" }>, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  const a = AXEL * sk;
  const vTid = n.v === "." ? null : p.reservera(160);
  const inne = nod(n.inne, c, p);
  const hTid = n.h === "." ? null : p.reservera(160);
  // En exponent eller ett index får plats bredvid vanliga parenteser, som i E[X^2]. Ett bråk eller en summa gör dem större.
  const ryms = inne.h <= 1.0 * sk && inne.d <= 0.4 * sk;
  const halv = Math.max(inne.h - a, inne.d + a, 0.5 * sk) + 0.08 * sk;
  const v = vTid ? avgransareRuta(n.v, halv, ryms, vTid, c) : null;
  const h = hTid ? avgransareRuta(n.h, halv, ryms, hTid, c) : null;
  const vw = v?.w ?? 0;
  const lov = [...(v?.lov ?? []), ...flytta(inne.lov, vw, 0), ...(h ? flytta(h.lov, vw + inne.w, 0) : [])];
  return {
    w: vw + inne.w + (h?.w ?? 0),
    h: Math.max(inne.h, v?.h ?? 0, h?.h ?? 0),
    d: Math.max(inne.d, v?.d ?? 0, h?.d ?? 0),
    lov,
    fore: n.kv,
    efter: n.kh,
  };
}

/** \big( och de andra: en avgränsare med fast storlek. */
function delim(n: Extract<Nod, { t: "delim" }>, c: Ctx, p: Penna): Ruta {
  const sk = SKALA[c.stil];
  if (n.s === ".") return { ...tomRuta(), w: 0.12 * sk, fore: n.k, efter: n.k };
  const r = avgransareRuta(n.s, (n.storlek * sk) / 2, false, p.reservera(160), c);
  return r ? { ...r, fore: n.k, efter: n.k } : tomRuta();
}

/* ---------- Matriser, cases och aligned ---------- */

function tabell(n: Extract<Nod, { t: "tabell" }>, c: Ctx, p: Penna): Ruta {
  if (!n.rader.length) return tomRuta();
  const sk = SKALA[c.stil];
  const cellStil = n.justering === "rl" ? c.stil : Math.max(c.stil, 1);
  const cs = SKALA[cellStil];
  const celler = n.rader.map((rad) => rad.map((cell) => nod(cell, medStil(c, cellStil), p)));
  const kolumner = Math.max(...celler.map((r) => r.length));
  const cw = Array.from({ length: kolumner }, (_, j) => Math.max(0, ...celler.map((r) => r[j]?.w ?? 0)));
  const rh = celler.map((r) => Math.max(0.72 * cs, ...r.map((x) => x.h)));
  const rd = celler.map((r) => Math.max(0.26 * cs, ...r.map((x) => x.d)));
  const xs: number[] = [];
  let x = 0;
  for (let j = 0; j < kolumner; j++) {
    if (j > 0) x += n.justering === "rl" ? (j % 2 ? 0.3 : 1.2) * sk : n.justering === "l" ? 1 * sk : 0.8 * sk;
    xs.push(x);
    x += cw[j];
  }
  const ys: number[] = [];
  let y = 0;
  for (let i = 0; i < celler.length; i++) {
    if (i > 0) y += rd[i - 1] + 0.22 * sk + rh[i];
    ys.push(y);
  }
  const hela = rh[0] + y + rd[rd.length - 1];
  const a = AXEL * sk;
  const dy = -(a + hela / 2) + rh[0];
  const lov: Lov[] = [];
  celler.forEach((rad, i) =>
    rad.forEach((cell, j) => {
      const just = n.justering === "rl" ? (j % 2 ? "l" : "r") : n.justering === "l" ? "l" : "c";
      const cx = xs[j] + (just === "r" ? cw[j] - cell.w : just === "c" ? (cw[j] - cell.w) / 2 : 0);
      lov.push(...flytta(cell.lov, cx, ys[i] + dy));
    }),
  );
  return { w: x, h: a + hela / 2, d: Math.max(0, hela / 2 - a), lov, fore: "inner", efter: "inner" };
}

/* ---------- In och ut ---------- */

/** Lägger ut formeln. slut är när sista strecket är ritat, i ms med perTecken ms per tecken. */
export function ritaFormel(tex: string, perTecken = 55): Ritad {
  const { noder, okanda, fel } = tolkaLatex(tex);
  const p = new Penna(perTecken);
  const r = lista(noder, { stil: 0, rod: false, bf: false, bb: false }, p);
  return { ruta: { ...r, h: Math.max(r.h, 0), d: Math.max(r.d, 0) }, slut: p.tid, okanda, fel };
}
