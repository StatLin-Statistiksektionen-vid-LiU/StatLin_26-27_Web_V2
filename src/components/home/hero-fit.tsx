"use client";

import { useEffect, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/*
 * Kurvan bakom startsidans hero. En dold tredjegradskurva ger punkterna, med brus. Den röda kurvan anpassas till alla punkter med
 * gradientnedstigning på medelkvadratfelet, och varje grå gissning gör detsamma men ser bara tolv av punkterna, så knippet visar hur
 * mycket en anpassning beror på urvalet. De lodräta strecken är residualerna, och felet skrivs i heronens hörn ([data-mse]).
 * Millimeterpapperet lyser rött längs den röda kurvan, starkare ju bättre den passar. Var nionde sekund dras ett nytt stickprov:
 * punkterna glider till sina nya lägen i en våg ut från loggan, och allt anpassas på nytt. Muspekaren är en punkt till, som väger
 * en fjärdedel av stickprovet: den röda kurvan flyttas direkt dit minsta kvadrat-anpassningen hamnar med punkten inräknad.
 * Animationen går även för den som valt bort rörelse: den är lugn, och det är den som är heronens innehåll.
 * Kurvorna är summor av Legendrepolynom. Allt räknas i loggans mått: s går från -1 vid heronens vänstra kant till 1 vid den högra
 * med loggan i 0, och höjden 1 är u pixlar, där loggans svarta ring har radien 7,5 u. Papperet (HeroGrid) läggs så att ringen står
 * inskriven i de grova rutorna. På en dator är ringen tre rutor bred, och u är då en fin ruta.
 */
type Vek = [number, number, number, number];
type Gissning = { w: Vek; ix: number[]; takt: number; alfa: number; fodd: number; liv: number };
type Stopp = [lage: number, farg: string, alfa: number];

const GISSNINGAR = 30;
const URVAL = 12;
const NYTT_STICKPROV = 9;
/** Vid ett nytt stickprov går en våg ut från loggan: så många sekunder tar den till kanten, och så länge glider varje punkt. */
const VAG = 1.3;
const GLID = 1;
/** Pekarens punkt väger så stor del av stickprovet. */
const DRAG = 0.25;
/** Den svarta ringens ytterkant i loggan, som andel av loggans bredd. */
const RING = (G.ringR + G.ringW / 2) / Number(LOGO_VIEWBOX.split(" ")[2]);
/** Den röda kurvans streck, underifrån: bredd i pixlar och styrka. */
const STRECK = [
  [5, 0.14],
  [2, 1],
] as const;
/** Papperets ljus längs kurvan: så många streck läggs på varandra, vart och ett så mycket bredare (i loggans mått) och med den styrkan. */
const LJUS = { streck: 8, bredd: 1.5, alfa: 0.13 };
/** Millimeterpapperets rutor i pixlar, som grid-millimeter i globals.css, och ljusets styrka i de grova och de fina linjerna. */
const RUTA = 80;
const FIN = 16;
const LJUS_GROV = 0.55;
const LJUS_FIN = 0.24;
/** Rött syns mer på ljust papper än på mörkt, så där dras ljuset ner så här mycket. */
const LJUS_PA_LJUST = 0.55;
/** Två körningar så nära varandra är Reacts StrictMode, inte en sida som visas igen (se IntroOnce). */
const SAMMA_START_MS = 200;
let spelad = 0;

const bas = (s: number): Vek => [1, s, (3 * s * s - 1) / 2, (5 * s * s * s - 3 * s) / 2];
const varde = (w: Vek, b: Vek) => w[0] * b[0] + w[1] * b[1] + w[2] * b[2] + w[3] * b[3];
const mellan = (p: number) => Math.min(1, Math.max(0, p));
const mjuk = (p: number) => {
  const q = mellan(p);
  return q < 0.5 ? 4 * q ** 3 : 1 - (2 - 2 * q) ** 3 / 2;
};
const brus = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
const rgb = (farg: string) => (farg.match(/[\d.]+/g) ?? []).slice(0, 3).join(",");

export function HeroFit() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const x = c?.getContext("2d");
    const yta = c?.closest("section");
    const logga = yta?.querySelector<HTMLElement>(".floating-logo");
    const ut = yta?.querySelector<HTMLElement>("[data-mse]");
    if (!c || !x || !yta || !logga) return;

    const nu = performance.now();
    const igen = spelad > 0 && nu - spelad > SAMMA_START_MS;
    spelad ||= nu;

    // Punkterna: jämna index till vänster om loggan och udda till höger. Läget går från loggans kant (0) till heronens (1).
    const n = yta.clientWidth < 640 ? 40 : 64;
    const alla = Array.from({ length: n }, (_, i) => i);
    const lage = alla.map(() => Math.random());
    const Y = alla.map(() => 0);
    const fran = [...Y];
    const till = [...Y];
    const rod: Vek = [0, 0, 0, 0];
    const ny = (fodd: number): Gissning => ({
      w: [3 * brus(), 6 * brus(), 5 * brus(), 5 * brus()],
      ix: Array.from({ length: URVAL }, (_, j) => 2 * Math.floor((Math.random() * n) / 2) + (j % 2)),
      takt: 0.7 + 1.1 * Math.random(),
      alfa: 0.3 + 0.7 * Math.random(),
      fodd,
      liv: 14 + 36 * Math.random(),
    });
    const gissningar = Array.from({ length: GISSNINGAR }, () => ny(0.25 + 0.5 * Math.random()));

    // Måtten, som mäts om när heron ändrar storlek: S och B är punkternas lägen och baser, SS och BS kurvornas.
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let u = 1;
    let hw = 1;
    let S: number[] = [];
    let B: Vek[] = [];
    let SS: number[] = [];
    let BS: Vek[] = [];
    let black = "";
    let rott = "";
    let ljus: CanvasPattern | null = null;
    const kakel = document.createElement("canvas");
    let gradG: CanvasGradient | string = "";
    let gradR: CanvasGradient | string = "";
    let t = 0;
    let bytt = -99;
    let mse = 0;
    // Pekarens punkt: läget, greppet (går mot faste medan pekaren är över papperet, annars mot noll) och den röda kurvan så som
    // den visas, med punkten inräknad.
    let pek = { s: 0, v: 0, b: bas(0) };
    let faste = 0;
    let grepp = 0;
    const visad: Vek = [0, 0, 0, 0];

    /** Ett steg nedför medelkvadratfelets gradient för kurvan k mot punkterna ix. */
    const steg = (k: Vek, ix: number[], takt: number) => {
      const grad: Vek = [0, 0, 0, 0];
      for (const i of ix) {
        const r = varde(k, B[i]) - Y[i];
        B[i].forEach((b, j) => (grad[j] += r * b));
      }
      // Polynomet av grad j har medelkvadraten 1/(2j+1), så dess steg skalas upp lika mycket och alla fyra går lika fort.
      grad.forEach((d, j) => (k[j] -= (takt / ix.length) * (2 * j + 1) * d));
    };
    /** Hur långt punkten har glidit mot sitt nya läge: vågen når den senare ju längre från loggan den ligger. */
    const fas = (i: number) => (t - bytt - VAG * Math.abs(S[i])) / GLID;

    const inom = (k: Vek) => BS.every((b) => varde(k, b) > -6.5 && varde(k, b) < 10.5);
    const sim = (dt: number) => {
      if (!w) return;
      t += dt;
      if (t - bytt > NYTT_STICKPROV) {
        // Den dolda kurvan stiger åt höger och håller sig i höjd med loggan.
        let dold: Vek;
        do dold = [3 * Math.random() - 1.5, 2.5 + 4 * Math.random(), 7 * Math.random() - 3.5, 7 * Math.random() - 3.5];
        while (!inom(dold));
        for (const i of alla) {
          till[i] = varde(dold, B[i]) + 2 * brus();
          fran[i] = bytt < 0 ? till[i] : Y[i];
        }
        bytt = t;
      }
      for (const i of alla) Y[i] = fran[i] + (till[i] - fran[i]) * mjuk(fas(i));
      steg(rod, alla, t > 1.6 ? 1.1 * dt : 0);
      gissningar.forEach((g, i) => {
        const alder = t - g.fodd;
        if (alder > g.liv + 1.5) gissningar[i] = ny(t);
        else if (alder > 0.7) steg(g.w, g.ix, g.takt * dt);
      });
      // Med pekarens punkt i stickprovet hamnar minsta kvadrat-anpassningen på ett annat ställe, och dit flyttas den visade kurvan
      // direkt. Med samma vikter som i steg är det en sluten formel: punktens hävstång avgör hur stor del av sin residual den tar igen.
      grepp += (faste - grepp) * (1 - Math.exp(-dt / 0.3));
      const vikt = DRAG * grepp;
      const havstang = pek.b.reduce((sum, p, j) => sum + (2 * j + 1) * p * p, 0);
      const ryck = (vikt * (pek.v - varde(rod, pek.b))) / (1 + vikt * havstang);
      const folj = 1 - Math.exp(-dt / 0.08);
      rod.forEach((k, j) => (visad[j] += (k + (2 * j + 1) * pek.b[j] * ryck - visad[j]) * folj));
      mse = alla.reduce((sum, i) => sum + (varde(visad, B[i]) - Y[i]) ** 2, 0) / n;
    };

    const rita = () => {
      const px = (s: number) => cx + s * hw;
      const py = (v: number) => cy - u * v;
      x.clearRect(0, 0, w, h);
      // Den röda kurvan växer ut ur loggan åt båda håll, och residualerna tänds när den når punkterna.
      const vaxt = mjuk((t - 1.1) / 1.5);
      const kurva = new Path2D();
      for (const s of SS) kurva.lineTo(px(vaxt * s), py(varde(visad, bas(vaxt * s))));
      x.lineJoin = x.lineCap = "round";
      // Papperet lyser längs kurvan, starkare ju mindre felet är.
      if (vaxt && ljus) {
        x.strokeStyle = ljus;
        x.globalAlpha = LJUS.alfa * vaxt * Math.min(1, 2 / Math.sqrt(mse));
        for (let k = 1; k <= LJUS.streck; k++) {
          x.lineWidth = k * LJUS.bredd * u;
          x.stroke(kurva);
        }
      }
      x.lineWidth = 0.7;
      x.strokeStyle = gradG;
      for (const g of gissningar) {
        const alder = t - g.fodd;
        if (alder <= 0) continue;
        x.globalAlpha = g.alfa * mellan(alder / 0.8) * mellan(1 - (alder - g.liv) / 1.5);
        x.beginPath();
        BS.forEach((b, j) => x.lineTo(px(SS[j]), py(varde(g.w, b))));
        x.stroke();
      }
      x.globalAlpha = 0.24;
      x.strokeStyle = black;
      x.beginPath();
      S.forEach((s, i) => {
        if (Math.abs(s) > vaxt) return;
        x.moveTo(px(s), py(Y[i]));
        x.lineTo(px(s), py(varde(visad, B[i])));
      });
      x.stroke();
      x.fillStyle = black;
      S.forEach((s, i) => {
        // Punkten lyser upp och växer medan den glider till sitt nya läge.
        const puls = fran[i] === till[i] ? 0 : Math.sin(Math.PI * mellan(fas(i)));
        x.globalAlpha = (0.5 + 0.3 * puls) * mellan((t - 0.2 - 0.4 * Math.abs(s)) / 0.5);
        x.beginPath();
        x.arc(px(s), py(Y[i]), Math.min(2.1, 0.17 * u) * (1 + 0.3 * puls), 0, 7);
        x.fill();
      });
      x.strokeStyle = gradR;
      for (const [bredd, alfa] of STRECK) {
        x.lineWidth = bredd;
        x.globalAlpha = alfa * Math.sign(vaxt);
        x.stroke(kurva);
      }
      if (grepp < 0.01) return;
      // Pekarens punkt i rött, med sin residual ner till kurvans värde där.
      const [qx, qy, fot] = [px(pek.s), py(pek.v), py(varde(visad, pek.b))];
      x.globalAlpha = grepp;
      x.lineWidth = 1;
      x.strokeStyle = x.fillStyle = rott;
      x.beginPath();
      x.moveTo(qx, qy);
      x.lineTo(qx, fot);
      x.stroke();
      for (const [y, r] of [
        [qy, 3.5],
        [fot, 2.5],
      ]) {
        x.beginPath();
        x.arc(qx, y, r, 0, 7);
        x.fill();
      }
    };

    const skriv = () => {
      if (!ut) return;
      ut.textContent = `MSE ${mse.toFixed(2).replace(".", ",")}`;
      if (t > 2.4) ut.dataset.pa = "";
    };

    const mat = () => {
      w = yta.clientWidth;
      h = yta.clientHeight;
      if (!w) return;
      const skarpa = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * skarpa);
      c.height = Math.round(h * skarpa);
      x.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      // Loggans mitt räknat från heronens hörn, och ringens radie.
      const ring = logga.offsetWidth * RING;
      u = ring / 7.5;
      cx = logga.offsetWidth / 2;
      cy = logga.offsetHeight / 2;
      for (let el: HTMLElement | null = logga; el && el !== yta; el = el.offsetParent as HTMLElement | null) {
        cx += el.offsetLeft;
        cy += el.offsetTop;
      }
      hw = Math.max(cx, w - cx);
      // Papperet läggs så att de grova linjerna tangerar ringen. Heroens rutnät följer --rx och --ry (globals.css), och ljuset här nedan gör detsamma.
      const [rx, ry] = [cx, cy].map((mitt) => Math.round(mitt + ring) % RUTA);
      yta.style.setProperty("--rx", `${rx}px`);
      yta.style.setProperty("--ry", `${ry}px`);
      yta.dataset.rutat = "";
      const kant = Math.min(0.6, (9.2 * u) / hw);
      S = lage.map((p, i) => (i % 2 ? 1 : -1) * (kant + (1 - kant) * p));
      B = S.map(bas);
      const bitar = 40 + Math.round(56 * mellan(w / 1400));
      SS = Array.from({ length: bitar + 1 }, (_, j) => (2 * j) / bitar - 1);
      BS = SS.map(bas);
      // Färgerna följer temat: text-ink och decoration-red på canvasen.
      const stil = getComputedStyle(c);
      const ink = rgb(stil.color);
      const rod3 = rgb(stil.textDecorationColor);
      black = `rgb(${ink})`;
      rott = `rgb(${rod3})`;
      const ton = (stopp: Stopp[]) => {
        const g = x.createLinearGradient(cx - hw, 0, cx + hw, 0);
        for (const [p, farg, alfa] of stopp) g.addColorStop(p, `rgba(${farg},${alfa})`);
        return g;
      };
      gradG = ton([[0, ink, 0.08], [0.3, ink, 0.24], [0.5, rod3, 0.6], [0.7, ink, 0.24], [1, ink, 0.08]]);
      gradR = ton([[0, rod3, 0.1], [0.22, rod3, 1], [0.78, rod3, 1], [1, rod3, 0.1]]);
      // Papperets ljus: en ruta av grid-millimeter i rött, som ett mönster i linje med heroens rutnät.
      const kx = kakel.getContext("2d");
      kakel.width = kakel.height = Math.round(RUTA * skarpa);
      if (kx) {
        const styrka = document.documentElement.dataset.tema === "mork" ? 1 : LJUS_PA_LJUST;
        kx.scale(kakel.width / RUTA, kakel.width / RUTA);
        for (let p = 0; p < RUTA; p += FIN) {
          kx.fillStyle = `rgba(${rod3},${styrka * (p ? LJUS_FIN : LJUS_GROV)})`;
          kx.fillRect(p, 0, 1, RUTA);
          kx.fillRect(0, p, RUTA, 1);
        }
        ljus = x.createPattern(kakel, "repeat");
        ljus?.setTransform(new DOMMatrix().translate(rx, ry).scale(RUTA / kakel.width));
      }
      // Allt tonas ut innan det når hörnens text ovanför loggan, rubriken under den och heronens kanter.
      c.style.maskImage = `linear-gradient(#0000 ${cy - 13 * u}px, #000 ${cy - 9.5 * u}px, #000 ${cy + 8 * u}px, #0000 ${cy + 12 * u}px), linear-gradient(90deg, #0000, #000 7%, #000 93%, #0000)`;
      rita();
    };

    let raf = 0;
    let forra = 0;
    let skrivet = 0;
    const bild = (tid: number) => {
      sim(Math.min((tid - forra) / 1000, 0.05));
      forra = tid;
      rita();
      if (t - skrivet > 0.12) {
        skrivet = t;
        skriv();
      }
      raf = requestAnimationFrame(bild);
    };

    mat();
    // Den som kommer tillbaka till sidan slipper introt.
    if (igen) {
      for (let i = 0; i < 240; i++) sim(1 / 30);
      rita();
      skriv();
    }

    // Bara en mus är en punkt i stickprovet. Greppet släpper över loggan och utanför höjden där kurvorna syns, och där det håller är pekaren ett hårkors.
    const flytta = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = yta.getBoundingClientRect();
      const s = (e.clientX - r.left - cx) / hw;
      const v = (cy - e.clientY + r.top) / u;
      pek = { s, v, b: bas(s) };
      faste = mellan((Math.hypot(s * hw, v * u) / u - 9) / 2.5) * mellan((10 - Math.abs(v)) / 3);
      yta.style.cursor = faste > 0.5 ? "crosshair" : "";
    };
    const slapp = () => {
      faste = 0;
      yta.style.cursor = "";
    };
    yta.addEventListener("pointermove", flytta);
    yta.addEventListener("pointerleave", slapp);
    const storlek = new ResizeObserver(mat);
    storlek.observe(yta);
    const tema = new MutationObserver(mat);
    tema.observe(document.documentElement, { attributeFilter: ["data-tema"] });
    // Slingan går bara medan heron syns.
    const synlig = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) raf = requestAnimationFrame(bild);
    });
    synlig.observe(yta);
    return () => {
      cancelAnimationFrame(raf);
      yta.removeEventListener("pointermove", flytta);
      yta.removeEventListener("pointerleave", slapp);
      storlek.disconnect();
      tema.disconnect();
      synlig.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-ink decoration-red [mask-composite:intersect]" />;
}
