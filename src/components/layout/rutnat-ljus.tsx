"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { forbered, Orden } from "@/components/content/skrivning";

/** Ljusets radie i pixlar. Rutan som lyser är dubbelt så bred, se .rutnat-ljus i globals.css. */
const R = 200;

/**
 * Formlerna som skrivs på papperet där pekaren lyser. Bara tecken som Mynerve har: _ ger index och ^ exponent (tolka i
 * skrivning.tsx), och mellanslagen delar formeln i det som skrivs i ett drag.
 */
const FORMLER = [
  "σ^2 = E[(X − μ)^2]",
  "x̄ = Σ x_i / n",
  "s^2 = Σ(x_i − x̄)^2 / (n − 1)",
  "z = (x − μ) / σ",
  "P(A|B) = P(B|A) P(A) / P(B)",
  "ŷ = β_0 + β_1 x",
  "X ~ N(μ, σ^2)",
  "Var(X) = E[X^2] − E[X]^2",
  "r = Cov(X, Y) / σ_X σ_Y",
  "x̄ ± 1,96 · SE",
  "H_0 : μ = μ_0",
  "p < 0,05",
  "R^2 = 1 − SS_{res} / SS_{tot}",
  "E[X] = Σ x · p(x)",
  "L(θ) = Π f(x_i | θ)",
];
/** Så långt pekaren ska ha rört sig, och så länge sedan förra formeln, innan nästa skrivs. Högst två finns samtidigt. */
const STRACKA = 800;
const MELLANRUM = 2500;
const SAMTIDIGT = 2;
/** Formeln finns kvar så länge när den skrivits, och tonas sedan bort. Den syns bara i ljuset kring pekaren. */
const KVAR = 7000;
const TONAS = 1500;
/** Typsnittets storlek, rutnätets fina steg som formelns baslinje läggs på, och steget när den tomma ytan mäts. */
const STORLEK = 24;
const STEG = 16;
const SOK = 24;
/** Var tredje formel skrivs med rödpenna, de andra med bläck. */
const ROD_VAR = 3;

type Formel = { id: number; text: string; x: number; y: number; vrid: number; rod: boolean };

/** Det som inte är tomt papper: text, länkar, knappar, bilder och sådant som har en egen yta. */
const HINDER = "a, button, input, textarea, select, label, img, svg, video, canvas, iframe, p, h1, h2, h3, h4, h5, h6, li, dt, dd, td, th, blockquote, figure, pre, nav, dialog, [role=dialog]";
const genomskinlig = (farg: string) => farg === "transparent" || /^rgba\(.*,\s*0\)$/.test(farg) || /\/\s*0\)$/.test(farg);
const SIDOR = ["top", "right", "bottom", "left"] as const;
type Ruta = { l: number; t: number; r: number; b: number };

/** Går en synlig kant på elementet, som hårlinjen under ett sidhuvud, genom rutan? */
function linjeGenom(e: Element, ruta: Ruta) {
  const s = getComputedStyle(e);
  const q = e.getBoundingClientRect();
  for (const sida of SIDOR) {
    if (!(parseFloat(s.getPropertyValue(`border-${sida}-width`)) > 0)) continue;
    if (s.getPropertyValue(`border-${sida}-style`) === "none" || genomskinlig(s.getPropertyValue(`border-${sida}-color`))) continue;
    const kant = q[sida];
    const vagrat = sida === "top" || sida === "bottom";
    if (vagrat ? kant > ruta.t && kant < ruta.b && q.left < ruta.r && q.right > ruta.l : kant > ruta.l && kant < ruta.r && q.top < ruta.b && q.bottom > ruta.t) return true;
  }
  return false;
}

/**
 * Rutnätet lyser upp i rött kring muspekaren på hela sidan, som om sidan står på millimeterpapper.
 * Ramen täcker sidan och sidfoten och ligger bakom allt innehåll, så ljuset syns på det tomma papperet men inte genom kort med egen bakgrund.
 * Ljuset är en liten ruta som flyttas med translate, och rutnätet i den förskjuts lika mycket åt andra hållet. Linjerna ligger därför
 * stilla på sidan och sammanfaller med heroens rutnät, bara den lilla rutan målas om, och den följer med sidan när den scrollas.
 * Då och då skrivs en formel för hand på papperet under pekaren. Den hamnar mitt i den tomma ytan mellan innehållet, aldrig tätt
 * intill text eller i ett hörn av fönstret, och syns bara i ljuset: går pekaren vidare försvinner den, och efter en stund tonas den bort.
 * Bara med mus: CSS:en döljer ramen på pekskärmar. Med reducerad rörelse följer ljuset pekaren utan att tonas in och ut, och
 * formlerna står där direkt i stället för att skrivas fram.
 */
export function RutnatLjus() {
  const ref = useRef<HTMLDivElement>(null);
  const [formler, setFormler] = useState<Formel[]>([]);

  useEffect(() => {
    const ram = ref.current;
    const ljus = ram?.firstElementChild as HTMLElement | null;
    if (!ram || !ljus) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const stopp = ram.parentElement;

    // Ramens läge på sidan mäts när det behövs första gången och efter storleksändringar, inte vid varje rörelse.
    let origo: { x: number; y: number } | null = null;
    let raf = 0;
    let px = 0;
    let py = 0;
    let aktiv = false;
    // Formlerna: hur långt pekaren rört sig sedan förra, när den skrevs, vilken som står på tur och var de står.
    let stracka = 0;
    let senast = performance.now();
    let provad = 0;
    let nasta = Math.floor(Math.random() * FORMLER.length);
    let id = 0;
    let typsnitt: "inget" | "laddar" | "klart" = "inget";
    let matare: CanvasRenderingContext2D | null = null;
    let sida = location.pathname;
    const platser = new Map<number, { x: number; y: number }>();

    const matOrigo = () => {
      if (!origo) {
        const r = ram.getBoundingClientRect();
        origo = { x: r.left + window.scrollX, y: r.top + window.scrollY };
      }
      return origo;
    };

    /** Är punkten i fönstret tomt papper? Svaret för varje element sparas under ett försök, eftersom de flesta punkter hamnar i samma. */
    const svar = new Map<Element, boolean>();
    // Elementen som punkterna har träffat, för kontrollen av linjer i rutan.
    const traffade = new Set<Element>();
    const tomtElement = (el: Element) => {
      if (el.closest(HINDER)) return false;
      if ([...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) return false;
      // Har elementet eller något runt det en egen bakgrund ligger formeln under den och syns inte.
      for (let e: Element | null = el; e && e !== stopp; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundImage !== "none" || !genomskinlig(s.backgroundColor)) return false;
      }
      return true;
    };
    const tomt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      if (!el || el === document.documentElement || el === document.body) return false;
      traffade.add(el);
      let s = svar.get(el);
      if (s === undefined) {
        s = tomtElement(el);
        svar.set(el, s);
      }
      return s;
    };

    const skrivFormel = () => {
      const nu = performance.now();
      if (stracka < STRACKA || nu - senast < MELLANRUM || nu - provad < 200) return;
      provad = nu;
      // Typsnittet hämtas först när pekaren har rört sig en bit, och bara med mus.
      if (typsnitt !== "klart") {
        if (typsnitt === "inget") {
          typsnitt = "laddar";
          document.fonts.load(`${STORLEK}px "Mynerve"`, FORMLER.join(" ")).then(
            () => (typsnitt = "klart"),
            () => (typsnitt = "inget"),
          );
        }
        return;
      }
      if (platser.size >= SAMTIDIGT) return;
      const o = matOrigo();
      const sx = px + window.scrollX - o.x;
      const sy = py + window.scrollY - o.y;
      // Inte ovanpå en formel som redan står där.
      for (const p of platser.values()) if (Math.hypot(p.x - sx, p.y - sy) < 360) return;

      const text = FORMLER[nasta];
      matare ??= document.createElement("canvas").getContext("2d");
      if (!matare) return;
      matare.font = `${STORLEK}px Mynerve`;
      const bredd = Math.ceil(matare.measureText(text.replace(/[_^{}]/g, "")).width) + 8;
      const hojd = Math.round(STORLEK * 1.35);

      // Den tomma ytan kring pekaren, vågrätt och lodrätt. Fönstrets kanter räknas som innehåll, så att formeln inte hamnar i ett hörn.
      svar.clear();
      const vanster = ram.getBoundingClientRect().left + 48;
      const hoger = window.innerWidth - 48;
      const topp = 56;
      const botten = window.innerHeight - 56;
      if (px < vanster || px > hoger || py < topp || py > botten || !tomt(px, py)) return;
      let l = px;
      let r = px;
      let t = py;
      let b = py;
      while (l - SOK > vanster && px - l < 420 && tomt(l - SOK, py)) l -= SOK;
      while (r + SOK < hoger && r - px < 420 && tomt(r + SOK, py)) r += SOK;
      while (t - SOK > topp && py - t < 220 && tomt(px, t - SOK)) t -= SOK;
      while (b + SOK < botten && b - py < 220 && tomt(px, b + SOK)) b += SOK;
      if (r - l < bredd + 72 || b - t < hojd + 48) return;
      // Mitt i den tomma ytan, men så nära pekaren att formeln skrivs i ljuset.
      const klamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
      const cx = klamp(klamp((l + r) / 2, px - 110, px + 110), l + bredd / 2 + 36, r - bredd / 2 - 36);
      const cy = klamp(klamp((t + b) / 2, py - 50, py + 50), t + hojd / 2 + 24, b - hojd / 2 - 24);
      const x = cx - bredd / 2;
      const y = cy - hojd / 2;
      // Hela rutan med marginal ska vara tom, inte bara korset genom pekaren.
      traffade.clear();
      for (let i = 0; i <= 4; i++) {
        for (const yy of [y - 12, cy, y + hojd + 12]) if (!tomt(x - 16 + ((bredd + 32) * i) / 4, yy)) return;
      }
      // Och ingen hårlinje får gå genom den, som kanten mellan sidhuvudet och innehållet.
      const ruta = { l: x - 16, t: y - 12, r: x + bredd + 16, b: y + hojd + 12 };
      const runt = new Set<Element>();
      for (const el of traffade) for (let e: Element | null = el; e && e !== stopp && !runt.has(e); e = e.parentElement) runt.add(e);
      for (const e of runt) if (linjeGenom(e, ruta)) return;

      // Baslinjen hamnar på en linje i rutnätet. Med radhöjd 1 ligger baslinjen 0,775 em under rutans överkant (Mynerves höjd och djup).
      const baslinje = Math.round((y + hojd * 0.72 + window.scrollY - o.y) / STEG) * STEG;
      const formel: Formel = {
        id: ++id,
        text,
        x: Math.round(x + window.scrollX - o.x),
        y: baslinje - Math.round(STORLEK * 0.775),
        vrid: Math.round((Math.random() * 3 - 2) * 10) / 10,
        rod: id % ROD_VAR === 0,
      };
      platser.set(formel.id, { x: formel.x + bredd / 2, y: formel.y + hojd / 2 });
      nasta = (nasta + 1) % FORMLER.length;
      stracka = 0;
      senast = nu;
      setFormler((f) => [...f, formel]);
    };

    const rita = () => {
      raf = 0;
      // Efter ett sidbyte hör formlerna till förra sidan.
      if (location.pathname !== sida) {
        sida = location.pathname;
        origo = null;
        platser.clear();
        setFormler((f) => (f.length ? [] : f));
      }
      const o = matOrigo();
      const x = Math.round(px + window.scrollX - o.x);
      const y = Math.round(py + window.scrollY - o.y);
      ljus.style.setProperty("--x", `${x - R}px`);
      ljus.style.setProperty("--y", `${y - R}px`);
      // Formlerna syns i en cirkel kring pekaren, se .rutnat-formel.
      ram.style.setProperty("--px", `${x}px`);
      ram.style.setProperty("--py", `${y}px`);
      if (!aktiv) {
        aktiv = true;
        ram.dataset.aktiv = "";
      }
      skrivFormel();
    };
    const begar = () => {
      if (!raf) raf = requestAnimationFrame(rita);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (aktiv) stracka += Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
      begar();
    };
    // Scrollar man med hjulet står pekaren still i fönstret medan sidan rör sig, så ljuset flyttas med.
    const onScroll = () => {
      if (aktiv) begar();
    };
    // Pekaren lämnade fönstret.
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      aktiv = false;
      delete ram.dataset.aktiv;
    };
    const onResize = () => (origo = null);
    // En formel som tonats bort lämnar platsen fri.
    const onBorta = (e: Event) => platser.delete((e as CustomEvent<number>).detail);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    ram.addEventListener("formel-borta", onBorta);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ram.removeEventListener("formel-borta", onBorta);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="rutnat-ram">
      {/* Ljuset ska vara först i ramen, se effekten ovan. */}
      <div className="rutnat-ljus grid-millimeter" />
      {formler.map((f) => (
        <SkrivenFormel key={f.id} formel={f} klar={() => setFormler((alla) => alla.filter((a) => a.id !== f.id))} />
      ))}
    </div>
  );
}

/** En formel som skrivs fram, står kvar en stund och tonas bort. Med reducerad rörelse står den där direkt och tonas bara bort. */
function SkrivenFormel({ formel, klar }: { formel: Formel; klar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { ord, slut } = forbered(formel.text, 0, 55, 110);
  const klarRef = useRef(klar);
  useLayoutEffect(() => {
    klarRef.current = klar;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lugn = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.dataset.skriv = lugn ? "klar" : "skriver";
    let tona: Animation | undefined;
    const borta = () => {
      el.parentElement?.dispatchEvent(new CustomEvent("formel-borta", { detail: formel.id }));
      klarRef.current();
    };
    const timers = [
      window.setTimeout(() => (el.dataset.skriv = "klar"), lugn ? 0 : slut + 150),
      window.setTimeout(
        () => {
          // Med JavaScript, så att det tonas också med reducerad rörelse, där CSS-animationerna är avstängda.
          tona = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TONAS, easing: "ease-in", fill: "forwards" });
          tona.finished.then(borta, () => {});
        },
        (lugn ? 0 : slut) + KVAR,
      ),
    ];
    return () => {
      for (const t of timers) clearTimeout(t);
      tona?.cancel();
    };
  }, [slut, formel.id]);

  return (
    <div
      ref={ref}
      className={formel.rod ? "handskrift rutnat-formel rutnat-formel-rod" : "handskrift rutnat-formel"}
      style={{ left: formel.x, top: formel.y, "--fl": `${formel.x}px`, "--ft": `${formel.y}px`, "--vrid": `${formel.vrid}deg`, fontSize: STORLEK } as CSSProperties}
    >
      <Orden ord={ord} />
    </div>
  );
}
