"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Close } from "@/components/icons";
import type { SpeletProps } from "./spel-logga";

/*
 * Stapla normalen, eSTIG:s eget lilla spel. Block faller ner i nio kolumner och ska fylla varje stapel upp till sitt streck, så att
 * staplarna till slut följer normalfördelningens kurva. Ett block över strecket är ett extremvärde och kostar ett liv. Filen hämtas
 * först när någon trycker på loggan (spel-logga.tsx). Brädet ritas på en canvas, och rekordet sparas bara i webbläsaren.
 */

const KOL = 9;
const RADER = 12;
/** Raden under brädet med kolumnernas nummer, i celler. */
const ETIKETT = 0.8;
const LIV = 3;
const REKORD = "statlin-estig-rekord";
const BAKGRUND = "#12143a";
const RUTNAT = "rgb(44 170 223 / 0.1)";
const MAL = "#f7b042";
const KURVA = "#2caadf";
const FEL = "#ff4747";
/** eSTIG:s färger ur loggan, utom rött som betyder extremvärde. */
const FARGER = ["#2caadf", "#8457a6", "#f15a25", "#f7b042", "#6d70f0"];
/** Så länge ett extremvärde blinkar och nivåns "Normalfördelad!" står kvar, i millisekunder. */
const BLINK = 480;
const KLAR = 1700;

type Form = "ett" | "staende" | "liggande";
type Bit = { form: Form; x: number; y: number; farg: string };
type Fordelning = { mu: number; sigma: number; topp: number };
type Lage = "start" | "spelar" | "paus" | "klar" | "slut";
type Blink = { x: number; fran: number; till: number; slut: number };

type Tillstand = {
  niva: number;
  fordelning: Fordelning;
  nastaFordelning: Fordelning;
  /** Strecket i varje kolumn: så många block ska stapeln ha. */
  mal: number[];
  /** Blockens färger nerifrån och upp, per kolumn. */
  staplar: string[][];
  bit: Bit | null;
  nasta: Form;
  n: number;
  liv: number;
  lage: Lage;
  tid: number;
  snabb: boolean;
  blink: Blink[];
  klarTill: number;
  rekord: number;
  nyttRekord: boolean;
  bonus: number;
};

type Hud = Pick<Tillstand, "niva" | "fordelning" | "nastaFordelning" | "nasta" | "n" | "liv" | "lage" | "rekord" | "nyttRekord" | "bonus">;
type Utfall = { over: boolean; klar: boolean; slut: boolean };

/** Bitarnas celler som [kolumn, rad] från bitens nedre vänstra hörn. */
const CELLER: Record<Form, readonly (readonly [number, number])[]> = {
  ett: [[0, 0]],
  staende: [
    [0, 0],
    [0, 1],
  ],
  liggande: [
    [0, 0],
    [1, 0],
  ],
};

/** De fyra första nivåerna är bestämda. Sedan slumpas fördelningen. */
const NIVAER: Fordelning[] = [
  { mu: 4, sigma: 1.6, topp: 5 },
  { mu: 3.5, sigma: 1.5, topp: 6 },
  { mu: 4.5, sigma: 1.2, topp: 7 },
  { mu: 4, sigma: 2.2, topp: 6 },
];

function fordelningen(niva: number): Fordelning {
  if (niva <= NIVAER.length) return NIVAER[niva - 1];
  const mellan = (a: number, b: number, steg: number) => Math.round((a + Math.random() * (b - a)) / steg) * steg;
  return { mu: mellan(2.5, 5.5, 0.5), sigma: mellan(1.1, 2.4, 0.1), topp: mellan(5, 8, 1) };
}

const tathet = ({ mu, sigma, topp }: Fordelning, x: number) => topp * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
const malen = (f: Fordelning) => Array.from({ length: KOL }, (_, x) => Math.round(tathet(f, x)));
const tomma = () => Array.from({ length: KOL }, (): string[] => []);
/** Millisekunder per rad. Blocken faller lite fortare för varje nivå. */
const takt = (niva: number) => Math.max(110, 600 * 0.86 ** (niva - 1));
const tal = (v: number) => v.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
const behov = (s: Tillstand) => s.mal.map((m, x) => m - s.staplar[x].length);

/** Får biten plats någonstans utan att bli ett extremvärde? Annars blir den ett ensamt block, så att det alltid går att spela rätt. */
function passar(form: Form, b: number[]) {
  if (form === "ett") return b.some((v) => v > 0);
  if (form === "staende") return b.some((v) => v > 1);
  return b.some((v, x) => v > 0 && (b[x + 1] ?? 0) > 0);
}

function slumpaForm(niva: number, b: number[]): Form {
  const former: Form[] = niva >= 3 ? ["ett", "staende", "liggande"] : niva >= 2 ? ["ett", "staende"] : ["ett"];
  const mojliga = former.filter((f) => passar(f, b));
  return mojliga[Math.floor(Math.random() * mojliga.length)] ?? "ett";
}

function nyttTillstand(rekord: number): Tillstand {
  const fordelning = fordelningen(1);
  return {
    niva: 1,
    fordelning,
    nastaFordelning: fordelningen(2),
    mal: malen(fordelning),
    staplar: tomma(),
    bit: null,
    nasta: "ett",
    n: 0,
    liv: LIV,
    lage: "start",
    tid: 0,
    snabb: false,
    blink: [],
    klarTill: 0,
    rekord,
    nyttRekord: false,
    bonus: 0,
  };
}

const hudAv = (s: Tillstand): Hud => ({
  niva: s.niva,
  fordelning: s.fordelning,
  nastaFordelning: s.nastaFordelning,
  nasta: s.nasta,
  n: s.n,
  liv: s.liv,
  lage: s.lage,
  rekord: s.rekord,
  nyttRekord: s.nyttRekord,
  bonus: s.bonus,
});

function nyBit(s: Tillstand) {
  const b = behov(s);
  const form = passar(s.nasta, b) ? s.nasta : "ett";
  const bredd = form === "liggande" ? 2 : 1;
  const hojd = form === "staende" ? 2 : 1;
  s.bit = { form, x: Math.floor((KOL - bredd) / 2), y: RADER - hojd, farg: FARGER[Math.floor(Math.random() * FARGER.length)] };
  s.nasta = slumpaForm(s.niva, b);
  s.tid = 0;
}

function ledig(s: Tillstand, bit: Bit, x: number, y: number) {
  return CELLER[bit.form].every(([dx, dy]) => {
    const k = x + dx;
    return k >= 0 && k < KOL && y + dy >= s.staplar[k].length;
  });
}

/** Där bitens celler hamnar. En liggande bit delar sig när den landar, och varje halva faller ner i sin egen kolumn. */
function landning(s: Tillstand, bit: Bit): [number, number][] {
  if (bit.form === "staende") {
    const h = s.staplar[bit.x].length;
    return [
      [bit.x, h],
      [bit.x, h + 1],
    ];
  }
  return CELLER[bit.form].map(([dx]) => [bit.x + dx, s.staplar[bit.x + dx].length]);
}

function lasRekord() {
  try {
    const v = Number(localStorage.getItem(REKORD));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function sparaRekord(n: number) {
  try {
    localStorage.setItem(REKORD, String(n));
  } catch {
    // Utan lagring i webbläsaren gäller rekordet bara tills sidan laddas om.
  }
}

function landa(s: Tillstand, nu: number): Utfall {
  const bit = s.bit;
  if (!bit) return { over: false, klar: false, slut: false };
  s.bit = null;
  const rorda = new Set<number>();
  for (const [x] of landning(s, bit)) {
    s.staplar[x].push(bit.farg);
    rorda.add(x);
  }
  let extra = 0;
  for (const x of rorda) {
    const over = s.staplar[x].length - s.mal[x];
    if (over > 0) {
      s.blink.push({ x, fran: s.mal[x], till: s.staplar[x].length, slut: nu + BLINK });
      s.staplar[x].length = s.mal[x];
      extra += over;
    }
  }
  s.n += CELLER[bit.form].length - extra;
  if (extra > 0) {
    s.liv -= 1;
    if (s.liv <= 0) {
      s.lage = "slut";
      s.snabb = false;
      if (s.n > s.rekord) {
        s.rekord = s.n;
        s.nyttRekord = true;
        sparaRekord(s.n);
      }
      return { over: true, klar: false, slut: true };
    }
  }
  if (s.staplar.every((st, x) => st.length === s.mal[x])) {
    s.bonus = 5 * s.niva;
    s.n += s.bonus;
    s.lage = "klar";
    s.klarTill = nu + KLAR;
    s.nastaFordelning = fordelningen(s.niva + 1);
    return { over: extra > 0, klar: true, slut: false };
  }
  nyBit(s);
  return { over: extra > 0, klar: false, slut: false };
}

function nastaNiva(s: Tillstand) {
  s.niva += 1;
  s.fordelning = s.nastaFordelning;
  s.mal = malen(s.fordelning);
  s.staplar = tomma();
  s.blink = [];
  s.bonus = 0;
  s.lage = "spelar";
  s.nasta = slumpaForm(s.niva, behov(s));
  nyBit(s);
}

type Matt = { bredd: number; hojd: number; cell: number; dpr: number; typsnitt: string };

/** Ett block med ljus överkant och mörk underkant, som en pixel i ett gammalt spel. */
function block(ctx: CanvasRenderingContext2D, px: number, py: number, c: number, farg: string) {
  const i = Math.max(1, Math.round(c * 0.06));
  const k = Math.max(2, Math.round(c * 0.12));
  const b = c - 2 * i;
  ctx.fillStyle = farg;
  ctx.fillRect(px + i, py + i, b, b);
  ctx.fillStyle = "rgb(255 255 255 / 0.3)";
  ctx.fillRect(px + i, py + i, b, k);
  ctx.fillStyle = "rgb(0 0 0 / 0.25)";
  ctx.fillRect(px + i, py + c - i - k, b, k);
}

function rita(ctx: CanvasRenderingContext2D, s: Tillstand, m: Matt, nu: number) {
  const c = m.cell;
  const yp = (y: number) => (RADER - 1 - y) * c;
  const i = Math.max(2, Math.round(c * 0.14));
  ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
  ctx.fillStyle = BAKGRUND;
  ctx.fillRect(0, 0, m.bredd, m.hojd);

  // Kolumner som inte ska ha något alls är svagt röda.
  ctx.fillStyle = "rgb(255 71 71 / 0.08)";
  s.mal.forEach((mal, x) => {
    if (mal === 0) ctx.fillRect(x * c, 0, c, RADER * c);
  });

  ctx.strokeStyle = RUTNAT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < KOL; x++) {
    const p = Math.round(x * c) + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, RADER * c);
  }
  for (let y = 1; y <= RADER; y++) {
    const p = Math.round(y * c) + 0.5;
    ctx.moveTo(0, p);
    ctx.lineTo(KOL * c, p);
  }
  ctx.stroke();

  // Det som återstår av varje stapel är streckade rutor, och strecket visar var den ska sluta.
  const streck = Math.max(2, c * 0.12);
  ctx.setLineDash([streck, streck]);
  ctx.strokeStyle = "rgb(247 176 66 / 0.4)";
  for (let x = 0; x < KOL; x++) {
    for (let y = s.staplar[x].length; y < s.mal[x]; y++) ctx.strokeRect(x * c + i + 0.5, yp(y) + i + 0.5, c - 2 * i - 1, c - 2 * i - 1);
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = MAL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  s.mal.forEach((mal, x) => {
    if (mal === 0) return;
    const p = (RADER - mal) * c;
    ctx.moveTo(x * c + 2, p);
    ctx.lineTo((x + 1) * c - 2, p);
  });
  ctx.stroke();

  s.staplar.forEach((stapel, x) => stapel.forEach((farg, y) => block(ctx, x * c, yp(y), c, farg)));

  for (const b of s.blink) {
    const kvar = Math.max(0, (b.slut - nu) / BLINK);
    ctx.globalAlpha = Math.floor(kvar * 6) % 2 === 0 ? kvar : kvar * 0.3;
    for (let y = b.fran; y < b.till; y++) block(ctx, b.x * c, yp(y), c, FEL);
  }
  ctx.globalAlpha = 1;

  // Kurvan som staplarna ska följa.
  ctx.strokeStyle = KURVA;
  ctx.lineWidth = s.lage === "klar" ? 3 : 2;
  ctx.globalAlpha = s.lage === "klar" ? 1 : 0.8;
  ctx.beginPath();
  for (let k = 0; k <= KOL * 10; k++) {
    const x = k / 10 - 0.5;
    const py = (RADER - tathet(s.fordelning, x)) * c;
    if (k === 0) ctx.moveTo((x + 0.5) * c, py);
    else ctx.lineTo((x + 0.5) * c, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Skuggan visar var biten hamnar. Den är röd där biten skulle bli ett extremvärde.
  if (s.bit && s.lage === "spelar") {
    ctx.lineWidth = 2;
    for (const [x, y] of landning(s, s.bit)) {
      ctx.strokeStyle = y >= s.mal[x] ? FEL : "rgb(255 255 255 / 0.55)";
      ctx.strokeRect(x * c + i, yp(y) + i, c - 2 * i, c - 2 * i);
    }
    for (const [dx, dy] of CELLER[s.bit.form]) block(ctx, (s.bit.x + dx) * c, yp(s.bit.y + dy), c, s.bit.farg);
  }

  ctx.fillStyle = "rgb(255 255 255 / 0.45)";
  ctx.font = `${Math.round(c * 0.36)}px ${m.typsnitt}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < KOL; x++) ctx.fillText(String(x), (x + 0.5) * c, RADER * c + (ETIKETT * c) / 2);
}

type Styrning = { flytta: (dx: number) => void; snabb: (pa: boolean) => void; slapp: () => void; starta: () => void; paus: () => void };

export default function Spelet({ onStang }: SpeletProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dukRef = useRef<HTMLCanvasElement>(null);
  const ytaRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const fortsattRef = useRef<HTMLButtonElement>(null);
  const igenRef = useRef<HTMLButtonElement>(null);
  const styr = useRef<Styrning | null>(null);
  const [hud, setHud] = useState<Hud>(() => hudAv(nyttTillstand(lasRekord())));
  const [status, setStatus] = useState("");

  // Dialogen öppnas när filen har hämtats. Escape och Stäng stänger den, och då tas spelet bort (spel-logga.tsx).
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    startRef.current?.focus();
  }, []);

  // Knappen i rutan över brädet får fokus, så att tangentbordet når den.
  useEffect(() => {
    if (hud.lage === "paus") fortsattRef.current?.focus();
    if (hud.lage === "slut") igenRef.current?.focus();
  }, [hud.lage]);

  useEffect(() => {
    const duk = dukRef.current;
    const ctx = duk?.getContext("2d");
    if (!duk || !ctx) return;
    const s = nyttTillstand(lasRekord());
    const m: Matt = { bredd: 0, hojd: 0, cell: 0, dpr: 1, typsnitt: getComputedStyle(duk).fontFamily || "monospace" };
    let ram = 0;
    let senast = 0;
    let andrad = true;
    const visa = () => {
      setHud(hudAv(s));
      andrad = true;
    };
    const tillBradet = () => ytaRef.current?.focus({ preventScroll: true });

    const matt = () => {
      m.dpr = Math.min(3, window.devicePixelRatio || 1);
      m.bredd = duk.clientWidth;
      m.hojd = duk.clientHeight;
      m.cell = m.bredd / KOL;
      duk.width = Math.round(m.bredd * m.dpr);
      duk.height = Math.round(m.hojd * m.dpr);
      andrad = true;
    };
    const ro = new ResizeObserver(matt);
    ro.observe(duk);

    const efter = (u: Utfall) => {
      if (u.slut) setStatus(`Slut på liv. n = ${s.n}.${s.nyttRekord ? " Nytt rekord!" : ""}`);
      else if (u.klar) setStatus(`Normalfördelad! Bonus ${s.bonus}. Nästa nivå har μ = ${tal(s.nastaFordelning.mu)} och σ = ${tal(s.nastaFordelning.sigma)}.`);
      else if (u.over) setStatus(s.liv === 1 ? "Extremvärde! Ett liv kvar." : `Extremvärde! ${s.liv} liv kvar.`);
      visa();
    };
    const flytta = (dx: number) => {
      const bit = s.bit;
      if (s.lage !== "spelar" || !bit || !ledig(s, bit, bit.x + dx, bit.y)) return;
      bit.x += dx;
      andrad = true;
    };
    const slapp = () => {
      const bit = s.bit;
      if (s.lage !== "spelar" || !bit) return;
      while (ledig(s, bit, bit.x, bit.y - 1)) bit.y -= 1;
      efter(landa(s, performance.now()));
    };
    const starta = () => {
      Object.assign(s, nyttTillstand(s.rekord));
      s.lage = "spelar";
      nyBit(s);
      senast = 0;
      visa();
      setStatus(`Nivå 1. Fyll staplarna upp till strecken, μ = ${tal(s.fordelning.mu)} och σ = ${tal(s.fordelning.sigma)}.`);
      tillBradet();
    };
    const pausa = () => {
      if (s.lage !== "spelar") return;
      s.lage = "paus";
      s.snabb = false;
      visa();
      setStatus("Pausat.");
    };
    const fortsatt = () => {
      if (s.lage !== "paus") return;
      s.lage = "spelar";
      senast = 0;
      visa();
      setStatus("Spelet fortsätter.");
      tillBradet();
    };

    const steg = (t: number) => {
      ram = requestAnimationFrame(steg);
      const dt = senast ? Math.min(100, t - senast) : 0;
      senast = t;
      if (s.lage === "spelar") {
        s.tid += dt;
        if (s.tid >= (s.snabb ? 40 : takt(s.niva))) {
          s.tid = 0;
          const bit = s.bit;
          if (bit && ledig(s, bit, bit.x, bit.y - 1)) {
            bit.y -= 1;
            andrad = true;
          } else efter(landa(s, t));
        }
      } else if (s.lage === "klar" && t >= s.klarTill) {
        nastaNiva(s);
        visa();
        setStatus(`Nivå ${s.niva}.`);
      }
      if (s.blink.length) {
        s.blink = s.blink.filter((b) => b.slut > t);
        andrad = true;
      }
      if (andrad && m.cell > 0) {
        rita(ctx, s, m, t);
        andrad = false;
      }
    };

    const tangentNer = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const p = e.key === "p" || e.key === "P";
      if (s.lage === "paus" && p) {
        e.preventDefault();
        fortsatt();
        return;
      }
      if (s.lage !== "spelar") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        flytta(e.key === "ArrowLeft" ? -1 : 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        s.snabb = true;
      } else if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) slapp();
      } else if (p) {
        e.preventDefault();
        pausa();
      }
    };
    const tangentUpp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") s.snabb = false;
    };
    // Spelet pausar när fliken eller fönstret byts.
    const borta = () => {
      if (document.hidden || !document.hasFocus()) pausa();
    };

    styr.current = {
      flytta,
      snabb: (pa) => {
        s.snabb = pa && s.lage === "spelar";
      },
      slapp,
      starta,
      paus: () => (s.lage === "paus" ? fortsatt() : pausa()),
    };
    document.addEventListener("keydown", tangentNer);
    document.addEventListener("keyup", tangentUpp);
    document.addEventListener("visibilitychange", borta);
    window.addEventListener("blur", borta);
    matt();
    ram = requestAnimationFrame(steg);
    return () => {
      cancelAnimationFrame(ram);
      ro.disconnect();
      document.removeEventListener("keydown", tangentNer);
      document.removeEventListener("keyup", tangentUpp);
      document.removeEventListener("visibilitychange", borta);
      window.removeEventListener("blur", borta);
      styr.current = null;
    };
  }, []);

  const f = hud.fordelning;
  const spelar = hud.lage === "spelar" || hud.lage === "paus";
  return (
    <dialog ref={dialogRef} className="spel-dialog" aria-labelledby="spel-rubrik" aria-modal="true" onClose={onStang}>
      <div className="spel-topp">
        <div>
          <p className="spel-kicker">eSTIG · arkaden</p>
          <h2 id="spel-rubrik" className="spel-rubrik">
            Stapla normalen
          </h2>
        </div>
        <button type="button" className="spel-stang" onClick={() => dialogRef.current?.close()}>
          <Close size={15} /> Stäng
        </button>
      </div>

      <div className="spel-yta">
        <div ref={ytaRef} tabIndex={-1} className="spel-bradan">
          <canvas
            ref={dukRef}
            className="spel-duk"
            role="img"
            aria-label={`Nio staplar som ska följa normalfördelningen med μ = ${tal(f.mu)} och σ = ${tal(f.sigma)}.`}
          />
          {hud.lage !== "spelar" && (
            <div className="spel-lager" data-lage={hud.lage}>
              {hud.lage === "start" && (
                <>
                  <p className="spel-lager-rubrik">Fyll staplarna till strecken</p>
                  <p id="spel-regler" className="spel-lager-text">
                    När varje stapel når sitt streck följer de kurvan, och du går vidare till nästa nivå. Ett block över strecket är ett extremvärde och kostar
                    ett liv.
                  </p>
                  <button ref={startRef} type="button" className="spel-knapp" data-primar="" aria-describedby="spel-regler" onClick={() => styr.current?.starta()}>
                    Starta
                  </button>
                </>
              )}
              {hud.lage === "paus" && (
                <>
                  <p className="spel-lager-rubrik">Pausat</p>
                  <button ref={fortsattRef} type="button" className="spel-knapp" data-primar="" onClick={() => styr.current?.paus()}>
                    Fortsätt
                  </button>
                </>
              )}
              {hud.lage === "klar" && (
                <>
                  <p className="spel-lager-rubrik">Normalfördelad!</p>
                  <p className="spel-lager-text">
                    Bonus n&nbsp;+&nbsp;{hud.bonus}. Nästa nivå har μ&nbsp;=&nbsp;{tal(hud.nastaFordelning.mu)} och σ&nbsp;=&nbsp;{tal(hud.nastaFordelning.sigma)}.
                  </p>
                </>
              )}
              {hud.lage === "slut" && (
                <>
                  <p className="spel-lager-rubrik">Slut på liv</p>
                  <p className="spel-lager-text">
                    n&nbsp;=&nbsp;{hud.n}
                    {hud.nyttRekord ? ", nytt rekord!" : hud.rekord > 0 ? `. Rekordet är n = ${hud.rekord}.` : "."}
                  </p>
                  <button ref={igenRef} type="button" className="spel-knapp" data-primar="" onClick={() => styr.current?.starta()}>
                    Spela igen
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <dl className="spel-sida">
          <div>
            <dt>Nivå</dt>
            <dd>{hud.niva}</dd>
          </div>
          <div>
            <dt>Fördelning</dt>
            <dd>
              μ&nbsp;=&nbsp;{tal(f.mu)}, σ&nbsp;=&nbsp;{tal(f.sigma)}
            </dd>
          </div>
          <div>
            <dt>Poäng</dt>
            <dd>n&nbsp;=&nbsp;{hud.n}</dd>
          </div>
          <div>
            <dt>Liv</dt>
            <dd aria-label={`${hud.liv} av ${LIV}`}>
              {Array.from({ length: LIV }, (_, i) => (
                <span key={i} className="spel-hjarta" data-tomt={i >= hud.liv ? "" : undefined} aria-hidden>
                  ♥
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>Rekord</dt>
            <dd>n&nbsp;=&nbsp;{hud.rekord}</dd>
          </div>
          <div>
            <dt>Nästa</dt>
            <dd>
              <Nasta form={hud.nasta} />
            </dd>
          </div>
          {spelar && (
            <div className="spel-paus">
              <button type="button" className="spel-knapp" onClick={() => styr.current?.paus()}>
                {hud.lage === "paus" ? "Fortsätt" : "Paus"}
              </button>
            </div>
          )}
        </dl>
      </div>

      <div className="spel-kontroller">
        <HallKnapp etikett="Vänster" upprepa onTryck={() => styr.current?.flytta(-1)}>
          <ChevronLeft size={22} />
        </HallKnapp>
        <HallKnapp etikett="Snabbare ner" onHall={(pa) => styr.current?.snabb(pa)}>
          <ChevronDown size={22} />
        </HallKnapp>
        <HallKnapp etikett="Höger" upprepa onTryck={() => styr.current?.flytta(1)}>
          <ChevronRight size={22} />
        </HallKnapp>
        <HallKnapp etikett="Släpp" onTryck={() => styr.current?.slapp()}>
          Släpp
        </HallKnapp>
      </div>
      <p className="spel-hjalp">← → flyttar, ↓ snabbare, mellanslag släpper, P pausar</p>
      <p role="status" className="sr-only">
        {status}
      </p>
    </dialog>
  );
}

const FORM_NAMN: Record<Form, string> = { ett: "ett block", staende: "två block på höjden", liggande: "två block bredvid varandra" };

function Nasta({ form }: { form: Form }) {
  return (
    <span className="spel-nasta" role="img" aria-label={FORM_NAMN[form]}>
      {CELLER[form].map(([x, y]) => (
        <span key={`${x}-${y}`} style={{ gridColumn: x + 1, gridRow: 2 - y }} />
      ))}
    </span>
  );
}

/**
 * En knapp för fingrar: verkar direkt när den trycks ner, och sidorna upprepas så länge den hålls. Den tar inte fokus från brädet,
 * och med tangentbordet eller en skärmläsare fungerar den som en vanlig knapp.
 */
function HallKnapp({
  etikett,
  onTryck,
  onHall,
  upprepa = false,
  children,
}: {
  etikett: string;
  onTryck?: () => void;
  onHall?: (pa: boolean) => void;
  upprepa?: boolean;
  children: ReactNode;
}) {
  const timer = useRef<number | undefined>(undefined);
  const sluta = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
    timer.current = undefined;
    onHall?.(false);
  };
  return (
    <button
      type="button"
      aria-label={etikett}
      tabIndex={-1}
      className="spel-knapp"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onTryck?.();
        onHall?.(true);
        if (upprepa) {
          timer.current = window.setTimeout(() => {
            timer.current = window.setInterval(() => onTryck?.(), 80);
          }, 260);
        }
      }}
      onPointerUp={sluta}
      onPointerCancel={sluta}
      onLostPointerCapture={sluta}
      onClick={(e) => {
        if (e.detail === 0) onTryck?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
