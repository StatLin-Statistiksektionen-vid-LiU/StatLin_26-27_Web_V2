"use client";

import { useEffect, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/*
 * Bakgrunden i hero 2 (hero-strom.tsx): rutnätet, StatLin i jätteformat och prickarna från heron före omgörningen, och genom dem
 * en rullande tidsserie. Heron är alltid mörk, i sajtens mörka färger, så att den går ihop med sidan i mörkt läge.
 * Ordet är diagrammet: bokstäverna är kärl som fylls med rött upp till seriens linje, som ett ytdiagram som bara syns inne i
 * bokstäverna. Linjen stiger åt höger, så S är nästan tomt och N nästan fullt, och nivån i varje bokstav rör sig när serien
 * rullar förbi. Under introt fylls ordet från vänster i takt med att linjen ritas.
 * Seriens band lyser dessutom upp rutnätet i rött där det går fram. Prickarna är seriens observationer: de kommer in från höger,
 * glider åt vänster i seriens fart och ligger spridda kring bandets mitt, och när huvudet når dem tänds de som ligger inom
 * bandet. Längre bort glider glesare och svagare prickar långsammare. Prickarna viker undan för musen, som förr.
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
  /** Pekarens knuff, hur mycket bandet har tänt pricken, och läget som ritas. */
  ox: number;
  oy: number;
  tand: number;
  px: number;
  py: number;
};

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
const AMPLITUD = 4.2;
const BRUS = 5.5;
/**
 * Diagonalen stiger så många enheter från loggan ut till heronens kant, men aldrig brantare än så här. Den är flack,
 * så att linjen skär genom alla bokstäverna i ordet: lågt i den första och högt i den sista.
 */
const STIGNING = 4;
const BRANTAST = 0.2;
/** Seriens huvud står nästan ute vid högerkanten, så att hela ordet ligger i det som serien redan har ritat. */
const HUVUD = 0.95;
/** Bandets standardavvikelse i enheter, och hur många observationer det glidande medelvärdet väger in åt varje håll. */
const SIGMA_GRUND = 0.42;
const SIGMA_VOL = 0.36;
const FONSTER = 5;
/** Ljuset i bandet: band på band, från 1,2 till 2,8 standardavvikelser, så att det är jämnt inne i bandet och tonas ut kring kanten. */
const LJUS_LAGER = Array.from({ length: 8 }, (_, i) => 1.2 + (1.6 * i) / 7);
const LJUS_ALFA = 0.12;
/** Kring loggan dras serien mot diagonalen, så att loggan står på linjen. */
const FAST_VID_LOGGAN = 0.75;
/** Rutnätets rutor i pixlar, som i heron före omgörningen, och ordet i bakgrunden. */
const RUTA = 64;
const ORD = "STATLIN";
/**
 * Fyllningen i bokstäverna: hela ytan under linjen i en svag ton, och närmast under linjen skikt på skikt, så att det röda är
 * starkast vid ytan och tunnas ut nedåt som i ett ytdiagram. Djupen är i enheter.
 */
const FYLL_GRUND = 0.15;
const FYLL_SKIKT = [0.8, 1.8, 3.2, 5];
const FYLL_SKIKT_ALFA = 0.075;
/** Bokstävernas kontur under linjen. */
const KONTUR_ALFA = 0.9;
/** Observationerna sprids så många standardavvikelser kring bandets mitt. Bandet når två, så drygt hälften hamnar inom det. */
const SPRIDNING = 2.6;
/** Prickar närmare varandra än så här binds ihop med en linje. */
const LANK = 96;
/** Musen: inom så många pixlar viker prickarna undan, så långt som mest. */
const VIK = 130;
const KNUFF = 44;
/** Rött syns mer på ljust papper än på mörkt, så där dras det röda ner så här mycket. */
const LJUS_PA_LJUST = 0.72;
/** Introt: pennan ritar serien från vänsterkanten fram till huvudet. */
const PENNA_START = 0.25;
const PENNA_TID = 2.4;
const INTRO_SLUT = PENNA_START + PENNA_TID;
/** Två körningar så nära varandra är Reacts StrictMode, inte en sida som visas igen (se IntroOnce). */
const SAMMA_START_MS = 200;
let spelad = 0;

const mellan = (p: number) => Math.min(1, Math.max(0, p));
const mjuk = (p: number) => {
  const q = mellan(p);
  return q * q * (3 - 2 * q);
};
const brus = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
const tal = (farg: string) => (farg.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
/** Värdet i A vid ett läge mellan två observationer. */
const las = (A: number[], i: number) => {
  const k = Math.min(A.length - 2, Math.max(0, Math.floor(i)));
  return A[k] + (A[k + 1] - A[k]) * mellan(i - k);
};

export function StromFalt() {
  const grundRef = useRef<HTMLCanvasElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const grund = grundRef.current;
    const b = grund?.getContext("2d");
    const c = ref.current;
    const g = c?.getContext("2d");
    const yta = c?.closest("section");
    const logga = yta?.querySelector<HTMLElement>(".floating-logo");
    const rad = yta?.querySelector<HTMLElement>("[data-pst-rad]");
    const text = yta?.querySelector<HTMLElement>("[data-pst-text]");
    const ut = yta?.querySelector<HTMLElement>("[data-pst-matt]");
    // Fyllningen ritas på en egen duk och skärs till efter bokstäverna innan den läggs på den synliga.
    const fyllDuk = document.createElement("canvas");
    const fy = fyllDuk.getContext("2d");
    if (!grund || !b || !c || !g || !fy || !yta || !logga || !rad || !text) return;

    // Bakgrunden spelas också när enheten har valt bort rörelse: hela heron är undantagen, se regeln i globals.css.
    // Telefon: lägre upplösning, färre bilder och en glöd utan skuggoskärpa.
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

    // Måtten, som mäts om när heron ändrar storlek.
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
    let ordStorlek = 100;
    let ordFot = 0;
    let ink = [236, 235, 230];
    let rod = [255, 7, 7];
    let mork = true;
    let ljus: CanvasPattern | null = null;
    const rott = document.createElement("canvas");
    let typsnitt = false;
    let prickar: Prick[] = [];

    // Tiden sedan starten. Den som kommer tillbaka till sidan slipper introt.
    let t = igen ? INTRO_SLUT + 9 : 0;
    let forskjutning = 0;
    let pek = { x: 0, y: 0 };
    let faste = 0;
    let grepp = 0;

    const farg = (f: number[], alfa = 1) => `rgba(${f[0]},${f[1]},${f[2]},${alfa})`;
    /** Diagonalens höjd vid läget px, och en avvikelse i pixlar där: mindre kring loggan. */
    const ty = (px: number) => cy - lutning * (px - cx);
    const av = (px: number, dev: number) => skala * dev * (1 - FAST_VID_LOGGAN * Math.exp(-(((px - cx) / (1.25 * ring)) ** 2)));
    const penna = () => (t >= INTRO_SLUT ? Infinity : mjuk((t - PENNA_START) / PENNA_TID) * (xh + 4 * steg));
    /** Ordets typsnitt och plats: brett och fett som sajtens rubriker, mitt i heron. */
    const ordStil = (x: CanvasRenderingContext2D, storlek: number) => {
      x.font = `800 ${storlek}px "Archivo Variable", "Archivo", Arial, sans-serif`;
      if ("fontStretch" in x) x.fontStretch = "expanded";
      if ("letterSpacing" in x) x.letterSpacing = `${-0.02 * storlek}px`;
      x.textAlign = "center";
      x.textBaseline = "alphabetic";
      x.lineJoin = "round";
    };

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

    /** Rutnätet: i grått med ordets konturer på den synliga grunden, och i rött på den dolda duk som bandets ljus hämtar sitt mönster från. */
    const bakgrund = (x: CanvasRenderingContext2D, duk: HTMLCanvasElement, iLjus: boolean) => {
      const styrka = mork ? 1 : LJUS_PA_LJUST;
      duk.width = Math.round(w * skarpa);
      duk.height = Math.round(h * skarpa);
      x.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      x.clearRect(0, 0, w, h);
      if (iLjus) {
        x.fillStyle = farg(rod, 0.05 * styrka);
        x.fillRect(0, 0, w, h);
      }
      // Rutnätets linjer går genom loggans mitt.
      x.fillStyle = iLjus ? farg(rod, 0.5 * styrka) : farg(ink, 0.085);
      for (let px = cx % RUTA; px < w; px += RUTA) x.fillRect(Math.round(px), 0, 1, h);
      for (let py = cy % RUTA; py < h; py += RUTA) x.fillRect(0, Math.round(py), w, 1);
      if (iLjus) return;
      // Det grå rutnätet är tydligast kring loggan och tonas ut mot kanterna. I ljuset syns det överallt.
      const [rx, ry] = [0.62 * w, 0.95 * (zonBotten - zonTopp)];
      x.save();
      x.globalCompositeOperation = "destination-in";
      x.translate(cx, cy);
      x.scale(1, ry / rx);
      const ton = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      ton.addColorStop(0.25, "#000");
      ton.addColorStop(1, "#0000");
      x.fillStyle = ton;
      x.fillRect(-w, (-h * rx) / ry, 2 * w, (2 * h * rx) / ry);
      x.restore();
      // Ordet i konturer, lite bredare än heron, så att det skärs av i båda kanterna som förr.
      x.save();
      ordStil(x, ordStorlek);
      x.lineWidth = 1.5;
      x.strokeStyle = farg(ink, mork ? 0.12 : 0.14);
      x.strokeText(ORD, w / 2, ordFot);
      x.restore();
    };

    const skriv = () => {
      if (!ut || t < INTRO_SLUT) return;
      ut.textContent = `σ ${sigma[HI - 1].toFixed(2).replace(".", ",")}`;
      ut.dataset.pa = "";
    };

    const rita = () => {
      g.clearRect(0, 0, w, h);
      if (!w) return;
      const f = forskjutning / steg;
      const lerp = (a: number, c2: number) => a + (c2 - a) * f;
      const in_ = mjuk(t / 1.4);
      const styrka = mork ? 1 : LJUS_PA_LJUST;

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
      // Introt: pennan går från vänsterkanten till huvudet, och bara det som den har passerat syns.
      const spets = penna();
      const hx = Math.min(spets, xh);
      const hy = vid(Math.max(hx, X[0]), Y);
      // Linjen fram till huvudet eller pennans spets: det är ytan som bokstäverna fylls upp till.
      const LX: number[] = [];
      const LY: number[] = [];
      for (let i = 0; i <= sist && X[i] < hx; i++) {
        LX.push(X[i]);
        LY.push(Y[i]);
      }
      LX.push(hx);
      LY.push(hy);
      /** Ytan från linjen och så många pixlar ner, eller ända ner till heronens kant. */
      const under = (djup?: number) => {
        const p = new Path2D();
        LX.forEach((px, i) => (i ? p.lineTo(px, LY[i]) : p.moveTo(px, LY[i])));
        if (djup === undefined) {
          p.lineTo(hx, h);
          p.lineTo(LX[0], h);
        } else {
          for (let i = LX.length - 1; i >= 0; i--) p.lineTo(LX[i], LY[i] + djup);
        }
        p.closePath();
        return p;
      };

      // Linjerna mellan prickar som ligger nära varandra. Två tända prickar får en röd linje.
      g.lineWidth = 1;
      for (let i = 0; i < prickar.length; i++) {
        const p = prickar[i];
        for (let j = i + 1; j < prickar.length; j++) {
          const q = prickar[j];
          const dx = p.px - q.px;
          const dy = p.py - q.py;
          const d2 = dx * dx + dy * dy;
          if (d2 > LANK * LANK) continue;
          const k = Math.min(p.tand, q.tand);
          g.strokeStyle = k > 0.05 ? farg(rod) : farg(ink);
          g.globalAlpha = in_ * (0.085 + 0.15 * k) * (1 - Math.sqrt(d2) / LANK);
          g.beginPath();
          g.moveTo(p.px, p.py);
          g.lineTo(q.px, q.py);
          g.stroke();
        }
      }

      // Bandets ljus: rutnätet i rött inne i bandet, starkast i mitten.
      g.save();
      if (spets < Infinity) {
        g.beginPath();
        g.rect(0, 0, Math.max(0, spets), h);
        g.clip();
      }
      if (ljus) {
        g.fillStyle = ljus;
        g.globalAlpha = LJUS_ALFA;
        for (const s of LJUS_LAGER) {
          g.beginPath();
          for (let i = 0; i < BX.length; i++) g.lineTo(BX[i], BM[i] - s * BS[i]);
          for (let i = BX.length - 1; i >= 0; i--) g.lineTo(BX[i], BM[i] + s * BS[i]);
          g.closePath();
          g.fill();
        }
      }
      g.restore();

      // Ordet fylls upp till linjen. Först ytan under linjen i rött, starkast närmast linjen, och sedan skärs den till efter bokstäverna.
      if (hx > 0 && LX.length > 1) {
        fy.setTransform(skarpa, 0, 0, skarpa, 0, 0);
        fy.globalCompositeOperation = "source-over";
        fy.clearRect(0, 0, w, h);
        fy.fillStyle = farg(rod);
        fy.globalAlpha = FYLL_GRUND * styrka;
        fy.fill(under());
        fy.globalAlpha = FYLL_SKIKT_ALFA * styrka;
        for (const djup of FYLL_SKIKT) fy.fill(under(djup * u));
        fy.globalAlpha = 1;
        fy.globalCompositeOperation = "destination-in";
        fy.fillStyle = "#000";
        ordStil(fy, ordStorlek);
        fy.fillText(ORD, w / 2, ordFot);
        g.globalAlpha = in_;
        g.drawImage(fyllDuk, 0, 0, w, h);
        // Bokstävernas kontur är röd där de är fyllda.
        g.save();
        g.clip(under());
        ordStil(g, ordStorlek);
        g.lineWidth = 1.75;
        g.strokeStyle = farg(rod, KONTUR_ALFA * styrka);
        g.strokeText(ORD, w / 2, ordFot);
        g.restore();
        g.globalAlpha = 1;
      }

      // Prickarna: grå, och röda i den mån bandet har tänt dem.
      for (const p of prickar) {
        const k = p.tand;
        g.fillStyle = farg(k > 0.02 ? ink.map((v, i) => Math.round(v + (rod[i] - v) * k)) : ink);
        g.globalAlpha = in_ * Math.min(1, p.a * (1 + 0.9 * k));
        g.beginPath();
        g.arc(p.px, p.py, p.r * (1 + 0.3 * k), 0, 7);
        g.fill();
      }

      // Linjen. I mörkt läge lyser den, och på ljust papper är den platt med ett svagt bredare streck under.
      g.save();
      if (spets < Infinity) {
        g.beginPath();
        g.rect(0, 0, Math.max(0, spets), h);
        g.clip();
      }
      const linje = new Path2D();
      X.forEach((px, i) => (i ? linje.lineTo(px, Y[i]) : linje.moveTo(px, Y[i])));
      g.lineJoin = g.lineCap = "round";
      g.strokeStyle = farg(rod);
      if (grov || !mork) {
        for (const [bredd, alfa] of mork ? [[13, 0.045], [7, 0.09]] : [[5, 0.13]]) {
          g.globalAlpha = alfa;
          g.lineWidth = bredd;
          g.stroke(linje);
        }
      } else {
        g.shadowColor = farg(rod, 0.75);
        g.shadowBlur = 13;
      }
      g.globalAlpha = 1;
      g.lineWidth = 2;
      g.stroke(linje);
      g.restore();

      // Huvudet: den senaste observationen, eller pennans spets under introt.
      if (hx <= 0) return;
      const andning = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 2.8);
      const sken = g.createRadialGradient(hx, hy, 0, hx, hy, 18);
      sken.addColorStop(0, farg(rod, (mork ? 0.45 : 0.3) * andning));
      sken.addColorStop(1, farg(rod, 0));
      g.fillStyle = sken;
      g.beginPath();
      g.arc(hx, hy, 18, 0, 7);
      g.fill();
      g.fillStyle = farg(rod);
      g.beginPath();
      g.arc(hx, hy, 3.6, 0, 7);
      g.fill();
      // När pennan når fram går en ring ut från huvudet, en gång.
      const krus = (t - INTRO_SLUT) / 1.4;
      if (krus > 0 && krus < 1) {
        g.strokeStyle = farg(rod);
        g.lineWidth = 1.25;
        g.globalAlpha = 0.6 * (1 - krus);
        g.beginPath();
        g.arc(hx, hy, 4 + 22 * mjuk(krus), 0, 7);
        g.stroke();
      }
      g.globalAlpha = 1;
    };

    /** Prickarnas knuff från pekaren, bandet som tänder dem och läget som ritas. */
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
        p.tand += ((p.nara && p.inne && p.x <= spets ? 1 : 0) - p.tand) * foljLjus;
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
      for (const duk of [c, fyllDuk]) {
        duk.width = Math.round(w * skarpa);
        duk.height = Math.round(h * skarpa);
      }
      g.setTransform(skarpa, 0, 0, skarpa, 0, 0);
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
      yta.style.setProperty("--lx", `${cx}px`);
      yta.style.setProperty("--ly", `${cy}px`);
      // Färgerna läses från duken: bläck och rött.
      const stil = getComputedStyle(c);
      ink = tal(stil.color);
      rod = tal(stil.textDecorationColor);
      mork = true;
      // Ordet är lite bredare än heron och står med versalernas mitt i höjd med loggans mitt.
      ordStil(b, 100);
      ordStorlek = Math.min((100 * 1.05 * w) / b.measureText(ORD).width, 0.34 * w);
      ordStil(b, ordStorlek);
      ordFot = cy + b.measureText("S").actualBoundingBoxAscent / 2;

      bakgrund(b, grund, false);
      const rx = rott.getContext("2d");
      if (rx) {
        bakgrund(rx, rott, true);
        ljus = g.createPattern(rott, "no-repeat");
        ljus?.setTransform(new DOMMatrix().scale(1 / skarpa));
      }
      // Grunden visas först när ordets typsnitt har kommit, så att det inte byter form inför ögonen.
      if (typsnitt) yta.dataset.rutat = "";

      // Allt tonas ut innan det når raden ovanför loggan och rubriken under den, och det rörliga även mot heronens sidor.
      const v = `linear-gradient(#0000 ${zonTopp}px, #000 ${zonTopp + 2.5 * u}px, #000 ${zonBotten - 2.5 * u}px, #0000 ${zonBotten}px)`;
      grund.style.maskImage = v;
      c.style.maskImage = `${v}, linear-gradient(90deg, #0000, #000 5%, #000 95%, #0000)`;

      // Prickarna sås om när heron har bytt storlek: en observation per sjutton pixlar, och fonden efter ytan.
      if (Math.abs(w - forrW) > 1 || Math.abs(h - forrH) > 1 || !prickar.length) {
        const tathet = grov ? 0.6 : 1;
        sa(Math.round(tathet * Math.min(88, Math.max(20, w / 17))), Math.round(tathet * Math.min(36, Math.max(8, (w * (zonBotten - zonTopp)) / 24000))));
      }
      flytta_prickar(1);
      rita();
    };

    // Ett steg framåt i tiden. Serien och prickarna glider åt vänster, och en ny observation kommer in var gång serien har glidit ett steg.
    const fram = (dt: number) => {
      t += dt;
      forskjutning += FART * dt;
      while (forskjutning >= steg) {
        forskjutning -= steg;
        serie.shift();
        serie.push(nasta());
        jamna();
        skriv();
      }
      for (const p of prickar) {
        p.x -= FART * p.fart * dt;
        if (p.x < -40) fodd(p, w + 20 + 30 * Math.random());
      }
      grepp += (faste - grepp) * (1 - Math.exp(-dt / 0.2));
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
      rita();
      if (t >= INTRO_SLUT && ut && !ut.dataset.pa) skriv();
    };

    mat();
    skriv();

    // Prickarna viker undan för en mus mellan raden ovanför loggan och rubriken.
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
    const storlek = new ResizeObserver(mat);
    storlek.observe(yta);
    // Ordets typsnitt: väntar på det, men inte längre än en och en halv sekund.
    const medTypsnitt = () => {
      if (typsnitt) return;
      typsnitt = true;
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
      storlek.disconnect();
      synlig.disconnect();
    };
  }, []);

  return (
    <>
      <div aria-hidden className="pst-ton" />
      <canvas ref={grundRef} aria-hidden className="pst-grund" />
      <canvas ref={ref} aria-hidden className="pst-duk" />
    </>
  );
}
