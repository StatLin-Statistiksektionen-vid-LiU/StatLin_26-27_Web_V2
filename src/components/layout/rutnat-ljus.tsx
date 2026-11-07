"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Ritad } from "@/components/content/formel";
import { FormelVy } from "@/components/content/formel-vy";
import { lasFormler, type RutnatFormel } from "./formel-kalla";

/** Ljusets radie i pixlar. Rutan som lyser är dubbelt så bred, se .rutnat-ljus i globals.css. */
const R = 200;

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
type Formel = { id: number; ritad: Ritad; x: number; y: number; vrid: number; rod: boolean };

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
 * Rutnätet lyser upp i rött kring muspekaren där sidan har millimeterpapper: heron på startsidan och sidhuvudena, som har data-ljus.
 * Utanför dem lyser inget, och ljuset klipps vid ytans kanter, som vid hårlinjen under sidhuvudet.
 * Ramen täcker sidan och sidfoten och ligger bakom allt innehåll, så ljuset syns på det tomma papperet men inte genom kort med egen bakgrund.
 * Ljuset är en liten ruta som flyttas med translate, och rutnätet i den förskjuts lika mycket åt andra hållet. Linjerna ligger därför
 * stilla på sidan och sammanfaller med heroens rutnät, bara den lilla rutan målas om, och den följer med sidan när den scrollas.
 * Då och då skrivs en formel för hand på papperet under pekaren. Den hamnar mitt i den tomma ytan mellan innehållet, aldrig tätt
 * intill text eller i ett hörn av fönstret, och syns bara i ljuset: går pekaren vidare försvinner den, och efter en stund tonas den bort.
 * Formlerna står i LaTeX i blocket Handskriften (formel-kalla.ts) och läggs ut av formel.ts, som laddas först när pekaren har rört sig.
 * Bara med mus: CSS:en döljer ramen på pekskärmar. Med reducerad rörelse följer ljuset pekaren utan att tonas in och ut, men formlerna
 * skrivs ändå fram, eftersom det bara är bläck som syns fram och inget som rör sig.
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
    // Pekaren är i fönstret, elementet under den efter senaste rörelsen (null efter en scroll) och ytan som ljuset är klippt efter.
    let inne = false;
    let mal: EventTarget | null = null;
    let klippt: HTMLElement | null = null;
    // Formlerna: hur långt pekaren rört sig sedan förra, när den skrevs, vilken som står på tur och var de står.
    let stracka = 0;
    let senast = performance.now();
    let provad = 0;
    let nasta = Math.floor(Math.random() * 1000);
    let id = 0;
    let typsnitt: "inget" | "laddar" | "klart" = "inget";
    let motor: typeof import("@/components/content/formel") | null = null;
    // Formlerna som redan lagts ut, efter sin LaTeX.
    const ritade = new Map<string, Ritad>();
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

    /** Ytan med millimeterpapper under pekaren, eller null. */
    const ytaUnder = () => {
      const el = mal instanceof Element ? mal : document.elementFromPoint(px, py);
      mal = null;
      return el?.closest<HTMLElement>("[data-ljus]") ?? null;
    };
    /** Klipper ljuset och formlerna vid ytans kanter. Räknat från ramens övre vänstra hörn, så att det står still när sidan växer nedåt. */
    const klipp = (yta: HTMLElement) => {
      const r = ram.getBoundingClientRect();
      const q = yta.getBoundingClientRect();
      const v = Math.round(q.left - r.left);
      const t = Math.round(q.top - r.top);
      const h = Math.round(q.right - r.left);
      const b = Math.round(q.bottom - r.top);
      ram.style.clipPath = `polygon(${v}px ${t}px, ${h}px ${t}px, ${h}px ${b}px, ${v}px ${b}px)`;
      klippt = yta;
    };
    /** Släcker ljuset. Klippet står kvar medan det tonas ut och mäts om nästa gång pekaren kommer in i en yta. */
    const slack = () => {
      klippt = null;
      if (!aktiv) return;
      aktiv = false;
      delete ram.dataset.aktiv;
    };

    const skrivFormel = (yta: HTMLElement) => {
      const nu = performance.now();
      if (stracka < STRACKA || nu - senast < MELLANRUM || nu - provad < 200) return;
      provad = nu;
      // Formlerna och typsnittet hämtas först när pekaren har rört sig en bit, och bara med mus.
      if (typsnitt !== "klart" || !motor) {
        if (typsnitt === "inget") {
          typsnitt = "laddar";
          import("@/components/content/formel")
            .then((m) => m.laddaTypsnitt().then(() => (motor = m)))
            .then(
              () => (typsnitt = "klart"),
              () => (typsnitt = "inget"),
            );
        }
        return;
      }
      const alla = lasFormler();
      if (!alla.length || platser.size >= SAMTIDIGT) return;
      const o = matOrigo();
      const sx = px + window.scrollX - o.x;
      const sy = py + window.scrollY - o.y;
      // Inte ovanpå en formel som redan står där.
      for (const p of platser.values()) if (Math.hypot(p.x - sx, p.y - sy) < 360) return;

      // Den tomma ytan kring pekaren, vågrätt och lodrätt, i ytan som lyser. Dess och fönstrets kanter räknas som innehåll, så att
      // formeln inte hamnar i ett hörn.
      svar.clear();
      const q = yta.getBoundingClientRect();
      const vanster = Math.max(ram.getBoundingClientRect().left, q.left) + 48;
      const hoger = Math.min(window.innerWidth, q.right) - 48;
      const topp = Math.max(56, q.top + 24);
      const botten = Math.min(window.innerHeight - 56, q.bottom - 24);
      if (px < vanster || px > hoger || py < topp || py > botten || !tomt(px, py)) return;
      let l = px;
      let r = px;
      let t = py;
      let b = py;
      while (l - SOK > vanster && px - l < 420 && tomt(l - SOK, py)) l -= SOK;
      while (r + SOK < hoger && r - px < 420 && tomt(r + SOK, py)) r += SOK;
      while (t - SOK > topp && py - t < 220 && tomt(px, t - SOK)) t -= SOK;
      while (b + SOK < botten && b - py < 220 && tomt(px, b + SOK)) b += SOK;
      // Nästa formel i ordningen som ryms i ytan, med 4 px runt om för bläck som går utanför tecknen. En som är för stor här hoppas
      // över den här gången, så att en lång formel inte stoppar de andra.
      let valt: RutnatFormel | null = null;
      let ritad: Ritad | null = null;
      let bredd = 0;
      let hojd = 0;
      for (let i = 0; i < alla.length && !valt; i++) {
        const f = alla[(nasta + i) % alla.length];
        let rf = ritade.get(f.tex);
        if (!rf) ritade.set(f.tex, (rf = motor.ritaFormel(f.tex)));
        const w = Math.ceil(rf.ruta.w * STORLEK) + 8;
        const h = Math.ceil((rf.ruta.h + rf.ruta.d) * STORLEK) + 8;
        if (r - l < w + 72 || b - t < h + 36) continue;
        [valt, ritad, bredd, hojd] = [f, rf, w, h];
        nasta += i;
      }
      if (!valt || !ritad) return;
      // Mitt i den tomma ytan, men så nära pekaren att formeln skrivs i ljuset.
      const klamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
      const cx = klamp(klamp((l + r) / 2, px - 110, px + 110), l + bredd / 2 + 36, r - bredd / 2 - 36);
      const cy = klamp(klamp((t + b) / 2, py - 50, py + 50), t + hojd / 2 + 18, b - hojd / 2 - 18);
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
      // Inte heller över en anteckning eller dess pil. De står i ett lager som inte tar klick, så punkterna ovan går rakt igenom dem.
      for (const el of document.querySelectorAll(".anteckning-lapp, .anteckning-pil path")) {
        const q = el.getBoundingClientRect();
        if ((q.width || q.height) && q.left < ruta.r + 12 && q.right > ruta.l - 12 && q.top < ruta.b + 12 && q.bottom > ruta.t - 12) return;
      }

      // Baslinjen hamnar på en linje i rutnätet, och formelns överkant ligger h em över den.
      const ovan = ritad.ruta.h * STORLEK;
      const baslinje = Math.round((y + 4 + ovan + window.scrollY - o.y) / STEG) * STEG;
      const formel: Formel = {
        id: ++id,
        ritad,
        x: Math.round(x + 4 + window.scrollX - o.x),
        y: Math.round(baslinje - ovan),
        vrid: Math.round((Math.random() * 3 - 2) * 10) / 10,
        rod: !!valt.rod,
      };
      platser.set(formel.id, { x: formel.x + bredd / 2, y: formel.y + hojd / 2 });
      nasta++;
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
        klippt = null;
        platser.clear();
        setFormler((f) => (f.length ? [] : f));
      }
      // Bara där sidan har millimeterpapper.
      const yta = inne ? ytaUnder() : null;
      if (!yta) return slack();
      if (klippt !== yta) klipp(yta);
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
      skrivFormel(yta);
    };
    const begar = () => {
      if (!raf) raf = requestAnimationFrame(rita);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (aktiv) stracka += Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
      mal = e.target;
      inne = true;
      begar();
    };
    // Scrollar man med hjulet står pekaren still i fönstret medan sidan rör sig, så ljuset flyttas med, och tänds eller släcks
    // när en yta med millimeterpapper kommer in under pekaren eller lämnar den.
    const onScroll = () => {
      if (inne) begar();
    };
    // Pekaren lämnade fönstret.
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      inne = false;
      slack();
    };
    const onResize = () => {
      origo = null;
      klippt = null;
    };
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

/**
 * En formel som skrivs fram, står kvar en stund och tonas bort. Den skrivs fram även med reducerad rörelse: där släpper CSS:en
 * igenom just de här animationerna (globals.css), och toningen görs med JavaScript.
 */
function SkrivenFormel({ formel, klar }: { formel: Formel; klar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { ruta, slut } = formel.ritad;
  const klarRef = useRef(klar);
  useLayoutEffect(() => {
    klarRef.current = klar;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.skriv = "skriver";
    let tona: Animation | undefined;
    const borta = () => {
      el.parentElement?.dispatchEvent(new CustomEvent("formel-borta", { detail: formel.id }));
      klarRef.current();
    };
    const timers = [
      window.setTimeout(() => (el.dataset.skriv = "klar"), slut + 150),
      window.setTimeout(() => {
        tona = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TONAS, easing: "ease-in", fill: "forwards" });
        tona.finished.then(borta, () => {});
      }, slut + KVAR),
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
      style={
        {
          left: formel.x,
          top: formel.y,
          "--fl": `${formel.x}px`,
          "--ft": `${formel.y}px`,
          "--vrid": `${formel.vrid}deg`,
          // Formeln vrids kring baslinjens vänstra ände.
          transformOrigin: `0 ${Math.round((ruta.h / Math.max(ruta.h + ruta.d, 0.01)) * 100)}%`,
          fontSize: STORLEK,
        } as CSSProperties
      }
    >
      <FormelVy ruta={ruta} className="formel-block" />
    </div>
  );
}
