"use client";

import { useEffect, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/*
 * Bakgrunden i hero 3 (hero-strom-opus.tsx). Utgår från hero 1: rutnätet, StatLin i jätteformat, prickarna och den rullande
 * serien, men i sajtens mörka färger och utan glöd.
 * Pappret är strömmen. Rutnätet, prickarna och serien ligger på samma papper, som glider åt vänster i seriens fart som i en
 * skrivare. Det som står still i strömmen är loggan och ordet.
 * Ordet är av glas. Bokstäverna är rutor i samma material som sidans kort, och var och en förstorar det som glider förbi bakom
 * den. Rutnätets linjer, prickarna och seriens linje bryts i bokstävernas kanter, så att man ser strömmen gå genom namnet.
 * Under introt växer förstoringen fram, så att ordet stiger upp ur rutnätet.
 * Serien är ljuset som förr: där bandet går fram är rutnätet och bokstävernas kanter röda, och prickarna inom bandet tänds när
 * seriens huvud når dem. Prickarna viker undan för musen, som i heron före omgörningen, men inget tänds av den.
 * Serien är samma slumpvandring som i hero 1 (strom-v1-falt.tsx). Allt räknas i loggans mått: höjden 1 är u pixlar, och
 * loggans svarta ring har radien 7,5 u.
 */
type Punkt = { dev: number; vol: number };
type Prick = {
  /** Läget utan pekarens knuff. y gäller bara fondens prickar; observationernas höjd räknas från serien. */
  x: number;
  y: number;
  nara: boolean;
  /** Bandets mitt där observationen föddes, i seriens mått, och avståndet från den i pixlar. */
  mitt: number;
  res: number;
  inne: boolean;
  fart: number;
  r: number;
  a: number;
  /** Pekarens knuff, hur mycket ljuset har tänt pricken, och läget som ritas. */
  ox: number;
  oy: number;
  tand: number;
  px: number;
  py: number;
};
/** En bokstav i ordet: dess bit av bredden och mitten som glaset förstorar kring. */
type Bokstav = { x0: number; x1: number; mx: number };
type Rgb = [number, number, number];

/** Den svarta ringens ytterkant i loggan, som andel av loggans bredd. */
const RING = (G.ringR + G.ringW / 2) / Number(LOGO_VIEWBOX.split(" ")[2]);
/** Avståndet mellan observationerna i pixlar och farten åt vänster i pixlar per sekund. */
const STEG = 14;
const STEG_TELEFON = 10;
const FART = 21;
/** Så många observationer hålls i minnet. De sista är framtiden: serien är redan dragen dit prickarna kommer in vid högerkanten. */
const PUNKTER = 340;
const FRAMTID = 28;
/** Den observation som är på väg in vid huvudet. */
const HI = PUNKTER - 1 - FRAMTID;
/** Processens mjuka tak för avvikelsen, i processens eget mått, och hur många enheter det blir här. */
const TAK = 140;
const AMPLITUD = 5;
const BRUS = 5.5;
/** Diagonalen stiger så många enheter från loggan ut till heronens kant, men aldrig brantare än så här. */
const STIGNING = 6;
const BRANTAST = 0.22;
/** Seriens huvud står så långt ut mot högerkanten, räknat från loggan. */
const HUVUD = 0.84;
/** Bandets standardavvikelse i enheter, och hur många observationer det glidande medelvärdet väger in åt varje håll. */
const SIGMA_GRUND = 0.42;
const SIGMA_VOL = 0.36;
const FONSTER = 5;
/** Ljuset i bandet: tre band på varandra, vid 1,3, 2 och 2,7 standardavvikelser. Det ger tre platta steg i stället för en glöd. */
const LJUS_LAGER = [1.3, 2, 2.7];
const LJUS_ALFA = 0.3;
/** Kring loggan dras serien mot diagonalen, så att loggan står på linjen. */
const FAST_VID_LOGGAN = 0.75;
/** Rutnätets rutor i pixlar, som i heron före omgörningen, och ordet. */
const RUTA = 64;
const ORD = "STATLIN";
/** Glaset: så mycket bokstäverna förstorar, och när förstoringen växer fram efter att ordets typsnitt har kommit. */
const GLAS = 1.2;
const GLAS_FORDROJ = 0.15;
const GLAS_TID = 1.7;
/** Observationerna sprids så många standardavvikelser kring bandets mitt. Bandet når två, så drygt hälften hamnar inom det. */
const SPRIDNING = 2.6;
/** Prickar närmare varandra än så här binds ihop med en linje. */
const LANK = 96;
/** Musen: inom så många pixlar viker prickarna undan, och så långt som mest. */
const VIK = 130;
const KNUFF = 44;
/** Introt: pennan ritar serien från vänsterkanten fram till huvudet. */
const PENNA_START = 0.25;
const PENNA_TID = 2.1;
const INTRO_SLUT = PENNA_START + PENNA_TID;
/** Pappret står still medan pennan skriver och kommer sedan i gång, som en skrivare som startar. */
const GANG_START = 0.9;
const GANG_TID = 2.2;
/** Två körningar så nära varandra är Reacts StrictMode, inte en sida som visas igen (se IntroOnce). */
const SAMMA_START_MS = 200;
let spelad = 0;

const mellan = (p: number) => Math.min(1, Math.max(0, p));
const mjuk = (p: number) => {
  const q = mellan(p);
  return q * q * (3 - 2 * q);
};
const brus = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
/** Värdet i A vid ett läge mellan två observationer. */
const las = (A: number[], i: number) => {
  const k = Math.min(A.length - 2, Math.max(0, Math.floor(i)));
  return A[k] + (A[k + 1] - A[k]) * mellan(i - k);
};
/** En färg från getComputedStyle som tre tal. */
const rgb = (farg: string): Rgb => {
  const [r = 0, g = 0, b = 0] = (farg.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b];
};
const css = ([r, g, b]: Rgb, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const blanda = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function StromOpusFalt() {
  const glasRef = useRef<HTMLCanvasElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const glasDuk = glasRef.current;
    const b = glasDuk?.getContext("2d");
    const c = ref.current;
    const g = c?.getContext("2d");
    const yta = c?.closest("section");
    const logga = yta?.querySelector<HTMLElement>(".floating-logo");
    const rad = yta?.querySelector<HTMLElement>("[data-pso-rad]");
    const text = yta?.querySelector<HTMLElement>("[data-pso-text]");
    const dag = yta?.querySelector<HTMLElement>("[data-pso-dag]");
    // Dukar som aldrig visas: det rörliga lagret, glasets förstorade innandöme, bokstävernas form och ljusets mönster.
    const lager = document.createElement("canvas");
    const inre = document.createElement("canvas");
    const form = document.createElement("canvas");
    const rodOrd = document.createElement("canvas");
    const rodRuta = document.createElement("canvas");
    const tona = document.createElement("canvas");
    const L = lager.getContext("2d");
    const I = inre.getContext("2d");
    const F = form.getContext("2d");
    const R = rodOrd.getContext("2d");
    const RR = rodRuta.getContext("2d");
    const T = tona.getContext("2d");
    if (!glasDuk || !b || !c || !g || !yta || !logga || !rad || !text || !L || !I || !F || !R || !RR || !T) return;

    const stilla = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Telefon: lägre upplösning och färre bilder.
    const grov = window.matchMedia("(pointer: coarse)").matches;
    const nu = performance.now();
    const igen = spelad > 0 && nu - spelad > SAMMA_START_MS;
    spelad ||= nu;

    // Processen, som nextPoint i data-field.tsx.
    let logVol = 0;
    let chock = 0;
    let fart = 0;
    let niva = 0;
    let volJamn = 1;
    const nasta = (): Punkt => {
      logVol += -0.03 * logVol + 0.1 * brus();
      const vol = Math.exp(logVol);
      if (Math.random() < 0.012) chock += (Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 36);
      chock *= 0.93;
      fart += -0.1 * fart - 0.015 * niva + 2.6 * vol * brus();
      niva += fart;
      volJamn += (vol - volJamn) * 0.15;
      return { dev: TAK * Math.tanh((niva + chock + BRUS * vol * brus()) / TAK), vol: volJamn };
    };
    for (let i = 0; i < 300; i++) nasta();
    const serie = Array.from({ length: PUNKTER }, nasta);
    const medel: number[] = [];
    const sigma: number[] = [];
    /** Bandets mitt och bredd: glidande medelvärden av avvikelsen och volatiliteten. */
    const jamna = () => {
      for (let i = 0; i < serie.length; i++) {
        let d = 0;
        let v = 0;
        let summa = 0;
        for (let j = Math.max(0, i - FONSTER); j <= Math.min(serie.length - 1, i + FONSTER); j++) {
          const vikt = FONSTER + 1 - Math.abs(j - i);
          d += vikt * serie[j].dev;
          v += vikt * serie[j].vol;
          summa += vikt;
        }
        medel[i] = d / summa;
        sigma[i] = SIGMA_GRUND + (SIGMA_VOL * v) / summa;
      }
    };
    jamna();

    // Måtten, som mäts om när heron ändrar storlek eller temat byts.
    let w = 0;
    let h = 0;
    let skarpa = 1;
    let cx = 0;
    let cy = 0;
    let ring = 0;
    let u = 1;
    let xh = 0;
    let lutning = 0;
    let skala = 0;
    let steg = grov ? STEG_TELEFON : STEG;
    let zonTopp = 0;
    let zonBotten = 0;
    let storlek = 0;
    let vanster = 0;
    let baslinje = 0;
    let bokstaver: Bokstav[] = [];
    let ljusRuta: CanvasPattern | null = null;
    let ljusOrd: CanvasPattern | null = null;
    let rutBit = 1;
    let typsnitt = false;
    let prickar: Prick[] = [];
    // Färgerna följer temat: bläck, rött och sidans hårfina linjer.
    let ink: Rgb = [236, 235, 230];
    let rod: Rgb = [255, 7, 7];
    let linje: Rgb = [42, 41, 38];
    let kort: Rgb = [27, 27, 25];

    // Tiden sedan starten. Den som kommer tillbaka till sidan, eller har valt bort rörelse, slipper introt.
    let t = igen || stilla ? INTRO_SLUT + 9 : 0;
    /** När glaset började växa fram: först när ordets typsnitt har kommit. */
    let glasFran = igen || stilla ? -100 : Infinity;
    /** Hur långt pappret har glidit, i pixlar. */
    let vag = 0;
    let forskjutning = 0;
    let andrad = true;
    let pek = { x: 0, y: 0 };
    let faste = 0;
    let grepp = 0;

    /** Diagonalens höjd vid läget px, och en avvikelse i pixlar där: mindre kring loggan. */
    const ty = (px: number) => cy - lutning * (px - cx);
    const av = (px: number, dev: number) => skala * dev * (1 - FAST_VID_LOGGAN * Math.exp(-(((px - cx) / (1.25 * ring)) ** 2)));
    const penna = () => (t >= INTRO_SLUT ? Infinity : mjuk((t - PENNA_START) / PENNA_TID) * (xh + 4 * steg));
    const glas = () => (glasFran === Infinity ? 1 : 1 + (GLAS - 1) * mjuk((t - glasFran - GLAS_FORDROJ) / GLAS_TID));

    /** Läget i heron för ett element, utan transformer: rubriken och raden ovanför loggan glider in med fade-up. */
    const lage = (el: HTMLElement) => {
      let lx = 0;
      let ly = 0;
      for (let e: HTMLElement | null = el; e && e !== yta; e = e.offsetParent as HTMLElement | null) {
        lx += e.offsetLeft;
        ly += e.offsetTop;
      }
      return [lx, ly];
    };
    /** Ger en duk heronens storlek i skärmens pixlar, och dess ritverktyg heronens mått. */
    const anpassa = (duk: HTMLCanvasElement, x: CanvasRenderingContext2D) => {
      duk.width = Math.round(w * skarpa);
      duk.height = Math.round(h * skarpa);
      x.setTransform(skarpa, 0, 0, skarpa, 0, 0);
    };

    /** Sätter en prick på läget px. En observation får sin plats kring bandets mitt just där, en prick i fonden var som helst i höjdled. */
    const fodd = (p: Prick, px: number) => {
      p.x = px;
      p.ox = p.oy = p.tand = 0;
      if (p.nara) {
        const i = HI - 1 + forskjutning / steg + (px - xh) / steg;
        const s = u * las(sigma, i);
        p.mitt = las(medel, i);
        p.res = SPRIDNING * s * brus();
        p.inne = Math.abs(p.res) < 2 * s;
      } else {
        p.y = zonTopp + Math.random() * (zonBotten - zonTopp);
      }
    };
    const sa = (antalNara: number, antalFond: number) => {
      prickar = Array.from({ length: antalNara + antalFond }, (_, i) => {
        const nara = i < antalNara;
        const p: Prick = {
          x: 0,
          y: 0,
          nara,
          mitt: 0,
          res: 0,
          inne: false,
          fart: nara ? 1 : 0.28 + 0.34 * Math.random(),
          r: nara ? 1.1 + 1.2 * Math.random() : 0.7 + 0.7 * Math.random(),
          a: nara ? 0.36 + 0.4 * Math.random() : 0.12 + 0.2 * Math.random(),
          ox: 0,
          oy: 0,
          tand: 0,
          px: 0,
          py: 0,
        };
        fodd(p, -30 + Math.random() * (w + 60));
        return p;
      });
    };

    /** Ordets typsnitt, lite bredare än heron så att det skärs av i båda kanterna som förr. */
    const satt = (x: CanvasRenderingContext2D, px: number) => {
      x.font = `800 ${px}px "Archivo Variable", "Archivo", Arial, sans-serif`;
      if ("fontStretch" in x) x.fontStretch = "expanded";
      if ("letterSpacing" in x) x.letterSpacing = `${-0.02 * px}px`;
      x.textAlign = "left";
      x.lineJoin = "round";
    };
    /** Mäter ordet: storleken, var det börjar, baslinjen och var varje bokstav står. */
    const matOrdet = (x: CanvasRenderingContext2D) => {
      satt(x, 100);
      storlek = Math.min((100 * 1.05 * w) / x.measureText(ORD).width, 0.34 * w);
      satt(x, storlek);
      vanster = w / 2 - x.measureText(ORD).width / 2;
      baslinje = cy + x.measureText("S").actualBoundingBoxAscent / 2;
      bokstaver = Array.from(ORD, (_, i) => {
        const x0 = vanster + (i ? x.measureText(ORD.slice(0, i)).width : 0);
        const x1 = vanster + x.measureText(ORD.slice(0, i + 1)).width;
        return { x0: i ? x0 : -w, x1: i < ORD.length - 1 ? x1 : 2 * w, mx: (x0 + x1) / 2 };
      });
    };

    /** Det som står still: bokstäverna som glasrutor i kortens färg med en hårfin kant, och deras form för glaset. */
    const ritaOrdet = () => {
      anpassa(glasDuk, b);
      matOrdet(b);
      b.clearRect(0, 0, w, h);
      b.fillStyle = css(kort);
      b.fillText(ORD, vanster, baslinje);
      b.lineWidth = 1.25;
      b.strokeStyle = css(blanda(linje, ink, 0.12));
      b.strokeText(ORD, vanster, baslinje);

      anpassa(form, F);
      satt(F, storlek);
      F.fillStyle = "#000";
      F.fillText(ORD, vanster, baslinje);

      // Ljuset på bokstävernas kanter: samma kontur i rött, som bandet hämtar sitt mönster från.
      anpassa(rodOrd, R);
      satt(R, storlek);
      R.lineWidth = 1.75;
      R.strokeStyle = css(rod, 0.95);
      R.strokeText(ORD, vanster, baslinje);
      ljusOrd = g.createPattern(rodOrd, "no-repeat");
      ljusOrd?.setTransform(new DOMMatrix().scale(1 / skarpa));
    };

    /** Det rörliga lagrets grund: rutnätets ruta i rött för ljuset, och tonen som gör det grå rutnätet tydligast kring loggan. */
    const ritaRutor = () => {
      rutBit = Math.max(8, Math.round(RUTA * skarpa));
      rodRuta.width = rodRuta.height = rutBit;
      const tjock = Math.max(1, Math.round(skarpa));
      RR.clearRect(0, 0, rutBit, rutBit);
      RR.fillStyle = css(rod, 0.5);
      RR.fillRect(0, 0, tjock, rutBit);
      RR.fillRect(0, 0, rutBit, tjock);
      ljusRuta = L.createPattern(rodRuta, "repeat");

      anpassa(tona, T);
      const [rx, ry] = [0.62 * w, 0.95 * (zonBotten - zonTopp)];
      T.save();
      T.translate(cx, cy);
      T.scale(1, ry / rx);
      const ton = T.createRadialGradient(0, 0, 0, 0, 0, rx);
      ton.addColorStop(0.25, "#000");
      ton.addColorStop(1, "#0000");
      T.fillStyle = ton;
      T.fillRect(-w, (-h * rx) / ry, 2 * w, (2 * h * rx) / ry);
      T.restore();
    };

    const skriv = () => {
      if (!dag || dag.dataset.pa !== undefined || t < INTRO_SLUT) return;
      dag.textContent = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
      dag.dataset.pa = "";
    };

    const rita = () => {
      g.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      g.clearRect(0, 0, w, h);
      if (!w) return;
      L.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      L.clearRect(0, 0, w, h);
      const f = forskjutning / steg;
      const lerp = (a: number, c2: number) => a + (c2 - a) * f;
      const in_ = mjuk(t / 1.4);

      // Seriens synliga del, från vänsterkanten till huvudet: X och Y är linjen, M bandets mitt och S en standardavvikelse, i pixlar.
      const antal = Math.min(HI - 1, Math.ceil(xh / steg) + 2);
      const X: number[] = [];
      const Y: number[] = [];
      const M: number[] = [];
      const S: number[] = [];
      for (let i = HI - 1 - antal; i <= HI - 1; i++) {
        const px = xh - (f + HI - 1 - i) * steg;
        X.push(px);
        Y.push(ty(px) - av(px, serie[i].dev));
        M.push(ty(px) - av(px, medel[i]));
        S.push(u * sigma[i]);
      }
      X.push(xh);
      Y.push(ty(xh) - av(xh, lerp(serie[HI - 1].dev, serie[HI].dev)));
      M.push(ty(xh) - av(xh, lerp(medel[HI - 1], medel[HI])));
      S.push(u * lerp(sigma[HI - 1], sigma[HI]));
      const sist = X.length - 1;
      const vid = (px: number, A: number[]) => {
        if (px <= X[0]) return A[0];
        for (let i = 1; i <= sist; i++) {
          if (px > X[i]) continue;
          const d = X[i] - X[i - 1];
          return d > 0 ? A[i - 1] + ((A[i] - A[i - 1]) * (px - X[i - 1])) / d : A[i];
        }
        return A[sist];
      };
      // Bandet smalnar av till en spets strax förbi huvudet.
      const BX = [...X];
      const BM = [...M];
      const BS = [...S];
      for (let k = 1; k <= 4; k++) {
        BX.push(xh + k * steg);
        BM.push(M[sist] - lutning * k * steg);
        BS.push(S[sist] * (1 - k / 4.4));
      }
      const band = (x: CanvasRenderingContext2D, s: number) => {
        x.beginPath();
        for (let i = 0; i < BX.length; i++) x.lineTo(BX[i], BM[i] - s * BS[i]);
        for (let i = BX.length - 1; i >= 0; i--) x.lineTo(BX[i], BM[i] + s * BS[i]);
        x.closePath();
      };
      const spets = penna();
      const klipp = (x: CanvasRenderingContext2D) => {
        if (spets === Infinity) return;
        x.beginPath();
        x.rect(0, 0, Math.max(0, spets), h);
        x.clip();
      };

      // Rutnätet ligger på pappret och glider med det. Linjerna står på hela pixlar, så att de inte flimrar när de rör sig.
      const fas = (vag % RUTA) - (cx % RUTA);
      const hel = (px: number) => Math.round(px * skarpa) / skarpa;
      L.fillStyle = css(linje);
      for (let px = -fas - RUTA; px < w; px += RUTA) L.fillRect(hel(px), 0, 1, h);
      for (let py = cy % RUTA; py < h; py += RUTA) L.fillRect(0, hel(py), w, 1);
      L.globalCompositeOperation = "destination-in";
      L.drawImage(tona, 0, 0, w, h);
      L.globalCompositeOperation = "source-over";

      // Seriens ljus på rutnätet: samma rutor i rött inne i bandet, starkast i mitten. I ljuset syns rutnätet överallt.
      if (ljusRuta) {
        ljusRuta.setTransform(
          new DOMMatrix().translate(hel(-fas), hel(cy % RUTA)).scale(RUTA / rutBit),
        );
        L.save();
        klipp(L);
        L.fillStyle = ljusRuta;
        L.globalAlpha = LJUS_ALFA;
        for (const s of LJUS_LAGER) {
          band(L, s);
          L.fill();
        }
        L.restore();
      }

      // Linjerna mellan prickar som ligger nära varandra. Två tända prickar får en röd linje.
      L.lineWidth = 1;
      for (let i = 0; i < prickar.length; i++) {
        const p = prickar[i];
        for (let j = i + 1; j < prickar.length; j++) {
          const q = prickar[j];
          const dx = p.px - q.px;
          const dy = p.py - q.py;
          const d2 = dx * dx + dy * dy;
          if (d2 > LANK * LANK) continue;
          const k = Math.min(p.tand, q.tand);
          L.strokeStyle = css(k > 0.05 ? rod : ink);
          L.globalAlpha = in_ * (0.07 + 0.14 * k) * (1 - Math.sqrt(d2) / LANK);
          L.beginPath();
          L.moveTo(p.px, p.py);
          L.lineTo(q.px, q.py);
          L.stroke();
        }
      }

      // Prickarna: i bläck, och röda i den mån ljuset har tänt dem.
      for (const p of prickar) {
        const k = p.tand;
        L.fillStyle = css(k > 0.02 ? blanda(ink, rod, k) : ink);
        L.globalAlpha = in_ * Math.min(1, p.a * (1 + 0.9 * k));
        L.beginPath();
        L.arc(p.px, p.py, p.r * (1 + 0.3 * k), 0, 7);
        L.fill();
      }

      // Linjen: ett rent rött streck, utan glöd, som sidans röda ord.
      L.save();
      klipp(L);
      const streck = new Path2D();
      X.forEach((px, i) => (i ? streck.lineTo(px, Y[i]) : streck.moveTo(px, Y[i])));
      L.lineJoin = L.lineCap = "round";
      L.strokeStyle = css(rod);
      L.globalAlpha = 1;
      L.lineWidth = 2;
      L.stroke(streck);
      L.restore();

      // Huvudet: den senaste observationen, eller pennans spets under introt, med en tunn ring som andas.
      const hx = Math.min(spets, xh);
      if (hx > 0) {
        const hy = vid(hx, Y);
        const andning = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.8);
        L.globalAlpha = 1;
        L.fillStyle = css(rod);
        L.beginPath();
        L.arc(hx, hy, 3.4, 0, 7);
        L.fill();
        L.strokeStyle = css(rod);
        L.lineWidth = 1;
        L.globalAlpha = 0.25 + 0.3 * andning;
        L.beginPath();
        L.arc(hx, hy, 7 + 2 * andning, 0, 7);
        L.stroke();
        // När pennan når fram går en ring ut från huvudet, en gång.
        const krus = (t - INTRO_SLUT) / 1.4;
        if (krus > 0 && krus < 1) {
          L.lineWidth = 1.25;
          L.globalAlpha = 0.6 * (1 - krus);
          L.beginPath();
          L.arc(hx, hy, 4 + 22 * mjuk(krus), 0, 7);
          L.stroke();
        }
      }
      L.globalAlpha = 1;

      // Lagret på heron. Inne i bokstäverna syns det genom glaset: förstorat kring varje bokstavs mitt.
      g.globalAlpha = 1;
      g.drawImage(lager, 0, 0, w, h);
      const lins = glas();
      if (typsnitt && lins > 1.001) {
        g.globalCompositeOperation = "destination-out";
        g.drawImage(form, 0, 0, w, h);
        g.globalCompositeOperation = "source-over";
        I.setTransform(1, 0, 0, 1, 0, 0);
        I.clearRect(0, 0, inre.width, inre.height);
        I.setTransform(skarpa, 0, 0, skarpa, 0, 0);
        for (const bok of bokstaver) {
          I.save();
          I.beginPath();
          I.rect(bok.x0, 0, bok.x1 - bok.x0, h);
          I.clip();
          I.translate(bok.mx, cy);
          I.scale(lins, lins);
          I.translate(-bok.mx, -cy);
          I.drawImage(lager, 0, 0, w, h);
          I.restore();
        }
        I.globalCompositeOperation = "destination-in";
        I.drawImage(form, 0, 0, w, h);
        I.globalCompositeOperation = "source-over";
        g.drawImage(inre, 0, 0, w, h);
      }

      // Ljuset på bokstävernas kanter, ovanpå glaset.
      if (typsnitt && ljusOrd) {
        g.save();
        klipp(g);
        g.fillStyle = ljusOrd;
        g.globalAlpha = LJUS_ALFA;
        for (const s of LJUS_LAGER) {
          band(g, s);
          g.fill();
        }
        g.restore();
      }
    };

    /** Prickarnas knuff från pekaren, ljuset som tänder dem och läget som ritas. */
    const flytta_prickar = (dt: number) => {
      const spets = Math.min(penna(), xh);
      const foljKnuff = 1 - Math.exp(-dt / 0.18);
      const foljLjus = 1 - Math.exp(-dt / 0.35);
      for (const p of prickar) {
        const by = p.nara ? ty(p.x) - av(p.x, p.mitt) - p.res : p.y;
        let mx = 0;
        let my = 0;
        if (grepp > 0.01) {
          const dx = p.x - pek.x;
          const dy = by - pek.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < VIK) {
            const k = (1 - d / VIK) ** 2 * KNUFF * grepp;
            mx = (dx / d) * k;
            my = (dy / d) * k;
          }
        }
        p.ox += (mx - p.ox) * foljKnuff;
        p.oy += (my - p.oy) * foljKnuff;
        const mal = p.nara && p.inne && p.x <= spets ? 1 : 0;
        p.tand += (mal - p.tand) * foljLjus;
        p.px = p.x + p.ox;
        p.py = by + p.oy;
      }
    };

    const mat = () => {
      const [forrW, forrH] = [w, h];
      w = yta.clientWidth;
      h = yta.clientHeight;
      if (!w) return;
      skarpa = Math.min(window.devicePixelRatio || 1, grov ? 1.5 : 2);
      anpassa(c, g);
      anpassa(lager, L);
      anpassa(inre, I);
      const stil = getComputedStyle(c);
      ink = rgb(stil.color);
      rod = rgb(stil.textDecorationColor);
      linje = rgb(stil.borderTopColor);
      kort = rgb(stil.borderBottomColor);
      // Loggans mitt räknat från heronens hörn, och ringens radie.
      ring = logga.offsetWidth * RING;
      u = ring / 7.5;
      const [lx, ly] = lage(logga);
      cx = lx + logga.offsetWidth / 2;
      cy = ly + logga.offsetHeight / 2;
      xh = cx + HUVUD * (w - cx);
      lutning = Math.min(BRANTAST, (STIGNING * u) / Math.max(cx, w - cx));
      skala = (AMPLITUD * u) / TAK;
      steg = grov ? STEG_TELEFON : STEG;
      zonTopp = lage(rad)[1] + rad.offsetHeight;
      zonBotten = lage(text)[1];

      ritaOrdet();
      ritaRutor();
      // Glaset visas först när ordets typsnitt har kommit, så att det inte byter form inför ögonen.
      if (typsnitt) yta.dataset.rutat = "";

      // Allt tonas ut innan det når raden ovanför loggan och rubriken under den, och det rörliga även mot heronens sidor.
      const v = `linear-gradient(#0000 ${zonTopp}px, #000 ${zonTopp + 2.5 * u}px, #000 ${zonBotten - 2.5 * u}px, #0000 ${zonBotten}px)`;
      glasDuk.style.maskImage = v;
      c.style.maskImage = `${v}, linear-gradient(90deg, #0000, #000 6%, #000 94%, #0000)`;

      // Prickarna sås om när heron har bytt storlek: en observation per sjutton pixlar, och fonden efter ytan.
      if (Math.abs(w - forrW) > 1 || Math.abs(h - forrH) > 1 || !prickar.length) {
        const tathet = grov ? 0.6 : 1;
        sa(Math.round(tathet * Math.min(88, Math.max(20, w / 17))), Math.round(tathet * Math.min(36, Math.max(8, (w * (zonBotten - zonTopp)) / 24000))));
      }
      flytta_prickar(1);
      andrad = true;
      rita();
    };

    // Ett steg framåt i tiden. Pappret, serien och prickarna glider åt vänster, och en ny observation kommer in var gång serien har glidit ett steg.
    const fram = (dt: number) => {
      t += dt;
      if (!stilla) {
        const stracka = FART * mjuk((t - GANG_START) / GANG_TID) * dt;
        vag += stracka;
        forskjutning += stracka;
        while (forskjutning >= steg) {
          forskjutning -= steg;
          serie.shift();
          serie.push(nasta());
          jamna();
        }
        for (const p of prickar) {
          p.x -= stracka * p.fart;
          if (p.x < -40) fodd(p, w + 20 + 30 * Math.random());
        }
      }
      const fore = grepp;
      grepp += (faste - grepp) * (1 - Math.exp(-dt / 0.2));
      if (Math.abs(grepp - fore) > 0.002 || grepp > 0.01) andrad = true;
      flytta_prickar(dt);
    };

    let raf = 0;
    let forra = 0;
    const bild = (tid: number) => {
      raf = requestAnimationFrame(bild);
      // Telefonen ritar ungefär var 33:e ms. Gränsen ligger strax under, så att ingen bild hoppas över i onödan.
      if (grov && tid - forra < 30) return;
      const dt = Math.min((tid - forra) / 1000, 0.05);
      forra = tid;
      fram(dt);
      skriv();
      // Utan rörelse ritas bara om när något har ändrats: storleken, temat eller prickarnas knuff.
      if (stilla && !andrad) return;
      andrad = false;
      rita();
    };

    mat();
    skriv();

    // Prickarna viker undan för en mus, bara mellan raden ovanför loggan och rubriken.
    const flytta = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = yta.getBoundingClientRect();
      pek = { x: e.clientX - r.left, y: e.clientY - r.top };
      faste = pek.y > zonTopp && pek.y < zonBotten ? 1 : 0;
    };
    const slapp = () => {
      faste = 0;
    };
    yta.addEventListener("pointermove", flytta);
    yta.addEventListener("pointerleave", slapp);
    const storleken = new ResizeObserver(mat);
    storleken.observe(yta);
    // Temat byts på <html>: färgerna läses om.
    const temat = new MutationObserver(mat);
    temat.observe(document.documentElement, { attributeFilter: ["data-tema"] });
    // Ordets typsnitt: väntar på det, men inte längre än en och en halv sekund. Då börjar glaset växa fram.
    const medTypsnitt = () => {
      if (typsnitt) return;
      typsnitt = true;
      if (glasFran === Infinity) glasFran = t;
      mat();
    };
    document.fonts?.load('800 100px "Archivo Variable"').then(medTypsnitt, medTypsnitt);
    const vanta = window.setTimeout(medTypsnitt, 1500);
    document.fonts?.ready.then(mat);
    // Slingan går bara medan heron syns.
    const synlig = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) {
        forra = performance.now();
        raf = requestAnimationFrame(bild);
      }
    });
    synlig.observe(yta);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(vanta);
      yta.removeEventListener("pointermove", flytta);
      yta.removeEventListener("pointerleave", slapp);
      storleken.disconnect();
      temat.disconnect();
      synlig.disconnect();
    };
  }, []);

  return (
    <>
      <canvas ref={glasRef} aria-hidden className="pso-glas" />
      <canvas ref={ref} aria-hidden className="pso-duk" />
    </>
  );
}
