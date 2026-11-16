"use client";

import { useEffect, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/*
 * Bakgrunden i hero 1 (hero-strom-v1.tsx): rutnätet, StatLin i jätteformat och prickarna från heron före omgörningen, och genom
 * dem en rullande tidsserie. De hålls ihop av en sak: serien är ljuset. Allt i bakgrunden är grått tills seriens band
 * går över det, och då lyser det rött: rutnätets linjer, ordets konturer och prickarna.
 * Prickarna är seriens observationer. De kommer in från höger, glider åt vänster i seriens fart och ligger spridda kring bandets
 * mitt, så att serien går som en ryggrad genom svärmen. När seriens huvud når dem tänds de som ligger inom bandet. Längre bort
 * glider glesare och svagare prickar långsammare, som en fond. Musen är en lampa till: prickarna viker undan för den, och rutnätet
 * och ordet lyser rött omkring den.
 * Serien är en slumpvandring: volatiliteten vandrar långsamt, ibland kommer en chock som
 * klingar av, och nivån dras tillbaka mot diagonalen. Allt räknas i loggans mått: höjden 1 är u pixlar, och loggans svarta ring
 * har radien 7,5 u.
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
/** Ljuset i bandet: band på band, från 1,2 till 2,8 standardavvikelser, så att det är jämnt inne i bandet och tonas ut kring kanten. */
const LJUS_LAGER = Array.from({ length: 8 }, (_, i) => 1.2 + (1.6 * i) / 7);
const LJUS_ALFA = 0.13;
/** Kring loggan dras serien mot diagonalen, så att loggan står på linjen. */
const FAST_VID_LOGGAN = 0.75;
/** Rutnätets rutor i pixlar, som i heron före omgörningen, och ordet i bakgrunden. */
const RUTA = 64;
const ORD = "STATLIN";
/** Observationerna sprids så många standardavvikelser kring bandets mitt. Bandet når två, så drygt hälften hamnar inom det. */
const SPRIDNING = 2.6;
/** Prickar närmare varandra än så här binds ihop med en linje. */
const LANK = 96;
/** Musen: inom så många pixlar viker prickarna undan, så långt som mest, och så långt når lampans ljus. */
const VIK = 130;
const KNUFF = 44;
const LAMPA = 180;
const LAMPA_LAGER = [0.3, 0.45, 0.62, 0.8, 1];
/** Scenen är alltid mörk, så färgerna är fasta: bläck och sektionens röda. */
const INK = "236,235,230";
const ROD = "255,7,7";
/** Introt: pennan ritar serien från vänsterkanten fram till huvudet. */
const PENNA_START = 0.25;
const PENNA_TID = 2.1;
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
/** Värdet i A vid ett läge mellan två observationer. */
const las = (A: number[], i: number) => {
  const k = Math.min(A.length - 2, Math.max(0, Math.floor(i)));
  return A[k] + (A[k + 1] - A[k]) * mellan(i - k);
};

export function StromFaltV1() {
  const grundRef = useRef<HTMLCanvasElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const grund = grundRef.current;
    const b = grund?.getContext("2d");
    const c = ref.current;
    const g = c?.getContext("2d");
    const yta = c?.closest("section");
    const logga = yta?.querySelector<HTMLElement>(".floating-logo");
    const rad = yta?.querySelector<HTMLElement>("[data-pst1-rad]");
    const text = yta?.querySelector<HTMLElement>("[data-pst1-text]");
    const ut = yta?.querySelector<HTMLElement>("[data-pst1-matt]");
    if (!grund || !b || !c || !g || !yta || !logga || !rad || !text) return;

    const stilla = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    let ljus: CanvasPattern | null = null;
    const rott = document.createElement("canvas");
    let typsnitt = false;
    let prickar: Prick[] = [];

    // Tiden sedan starten. Den som kommer tillbaka till sidan, eller har valt bort rörelse, slipper introt.
    let t = igen || stilla ? INTRO_SLUT + 9 : 0;
    let forskjutning = 0;
    let andrad = true;
    let pek = { x: 0, y: 0 };
    let faste = 0;
    let grepp = 0;

    /** Diagonalens höjd vid läget px, och en avvikelse i pixlar där: mindre kring loggan. */
    const ty = (px: number) => cy - lutning * (px - cx);
    const av = (px: number, dev: number) => skala * dev * (1 - FAST_VID_LOGGAN * Math.exp(-(((px - cx) / (1.25 * ring)) ** 2)));
    const penna = () => (t >= INTRO_SLUT ? Infinity : mjuk((t - PENNA_START) / PENNA_TID) * (xh + 4 * steg));

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

    /** Rutnätet och ordet, i grått på den synliga grunden och i rött på den dolda duk som ljuset hämtar sitt mönster från. */
    const bakgrund = (x: CanvasRenderingContext2D, duk: HTMLCanvasElement, rod: boolean) => {
      duk.width = Math.round(w * skarpa);
      duk.height = Math.round(h * skarpa);
      x.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      x.clearRect(0, 0, w, h);
      if (rod) {
        x.fillStyle = `rgba(${ROD},0.05)`;
        x.fillRect(0, 0, w, h);
      }
      // Rutnätets linjer går genom loggans mitt.
      x.fillStyle = rod ? `rgba(${ROD},0.5)` : `rgba(${INK},0.085)`;
      for (let px = cx % RUTA; px < w; px += RUTA) x.fillRect(Math.round(px), 0, 1, h);
      for (let py = cy % RUTA; py < h; py += RUTA) x.fillRect(0, Math.round(py), w, 1);
      if (!rod) {
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
      }
      // Ordet i konturer, lite bredare än heron, så att det skärs av i båda kanterna som förr.
      const satt = (storlek: number) => {
        x.font = `800 ${storlek}px "Archivo Variable", "Archivo", Arial, sans-serif`;
        if ("fontStretch" in x) x.fontStretch = "expanded";
        if ("letterSpacing" in x) x.letterSpacing = `${-0.02 * storlek}px`;
      };
      x.save();
      satt(100);
      const storlek = Math.min((100 * 1.05 * w) / x.measureText(ORD).width, 0.34 * w);
      satt(storlek);
      x.textAlign = "center";
      x.lineJoin = "round";
      x.lineWidth = rod ? 1.75 : 1.5;
      x.strokeStyle = rod ? `rgba(${ROD},0.95)` : `rgba(${INK},0.1)`;
      x.strokeText(ORD, w / 2, cy + x.measureText("S").actualBoundingBoxAscent / 2);
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
          g.strokeStyle = k > 0.05 ? `rgb(${ROD})` : `rgb(${INK})`;
          g.globalAlpha = in_ * (0.085 + 0.15 * k) * (1 - Math.sqrt(d2) / LANK);
          g.beginPath();
          g.moveTo(p.px, p.py);
          g.lineTo(q.px, q.py);
          g.stroke();
        }
      }

      // Introt: pennan går från vänsterkanten till huvudet, och bara det som den har passerat lyser.
      const spets = penna();
      g.save();
      if (spets < Infinity) {
        g.beginPath();
        g.rect(0, 0, Math.max(0, spets), h);
        g.clip();
      }
      // Seriens ljus: rutnätet och ordet i rött inne i bandet, starkast i mitten.
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

      // Musens lampa: samma röda rutnät och ord i en cirkel kring pekaren.
      if (ljus && grepp > 0.01) {
        g.fillStyle = ljus;
        g.globalAlpha = 0.1 * grepp;
        for (const andel of LAMPA_LAGER) {
          g.beginPath();
          g.arc(pek.x, pek.y, LAMPA * andel, 0, 7);
          g.fill();
        }
      }

      // Prickarna: grå, och röda i den mån ljuset har tänt dem.
      for (const p of prickar) {
        const k = p.tand;
        g.fillStyle = k > 0.02 ? `rgb(${Math.round(236 + 19 * k)},${Math.round(235 - 228 * k)},${Math.round(230 - 223 * k)})` : `rgb(${INK})`;
        g.globalAlpha = in_ * Math.min(1, p.a * (1 + 0.9 * k));
        g.beginPath();
        g.arc(p.px, p.py, p.r * (1 + 0.3 * k), 0, 7);
        g.fill();
      }

      // Linjen, med glöd. Skuggoskärpan är dyr att rita, så telefonen får sin glöd av breda genomskinliga streck.
      g.save();
      if (spets < Infinity) {
        g.beginPath();
        g.rect(0, 0, Math.max(0, spets), h);
        g.clip();
      }
      const linje = new Path2D();
      X.forEach((px, i) => (i ? linje.lineTo(px, Y[i]) : linje.moveTo(px, Y[i])));
      g.lineJoin = g.lineCap = "round";
      g.strokeStyle = `rgb(${ROD})`;
      if (grov) {
        for (const [bredd, alfa] of [
          [13, 0.045],
          [7, 0.09],
        ]) {
          g.globalAlpha = alfa;
          g.lineWidth = bredd;
          g.stroke(linje);
        }
      } else {
        g.shadowColor = `rgba(${ROD},0.8)`;
        g.shadowBlur = 16;
      }
      g.globalAlpha = 1;
      g.lineWidth = 2;
      g.stroke(linje);
      g.restore();

      // Huvudet: den senaste observationen, eller pennans spets under introt.
      const hx = Math.min(spets, xh);
      if (hx <= 0) return;
      const hy = vid(hx, Y);
      const andning = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 2.8);
      const sken = g.createRadialGradient(hx, hy, 0, hx, hy, 18);
      sken.addColorStop(0, `rgba(${ROD},${0.45 * andning})`);
      sken.addColorStop(1, `rgba(${ROD},0)`);
      g.fillStyle = sken;
      g.beginPath();
      g.arc(hx, hy, 18, 0, 7);
      g.fill();
      g.fillStyle = `rgb(${ROD})`;
      g.beginPath();
      g.arc(hx, hy, 3.6, 0, 7);
      g.fill();
      // När pennan når fram går en ring ut från huvudet, en gång.
      const krus = (t - INTRO_SLUT) / 1.4;
      if (krus > 0 && krus < 1) {
        g.strokeStyle = `rgb(${ROD})`;
        g.lineWidth = 1.25;
        g.globalAlpha = 0.6 * (1 - krus);
        g.beginPath();
        g.arc(hx, hy, 4 + 22 * mjuk(krus), 0, 7);
        g.stroke();
      }
      g.globalAlpha = 1;
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
        let lampa = 0;
        if (grepp > 0.01) {
          const dx = p.x - pek.x;
          const dy = by - pek.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < VIK) {
            const k = (1 - d / VIK) ** 2 * KNUFF * grepp;
            mx = (dx / d) * k;
            my = (dy / d) * k;
          }
          if (d < LAMPA) lampa = grepp * (1 - d / LAMPA);
        }
        p.ox += (mx - p.ox) * foljKnuff;
        p.oy += (my - p.oy) * foljKnuff;
        const mal = Math.max(p.nara && p.inne && p.x <= spets ? 1 : 0, lampa);
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
      c.width = Math.round(w * skarpa);
      c.height = Math.round(h * skarpa);
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

    // Ett steg framåt i tiden. Serien och prickarna glider åt vänster, och en ny observation kommer in var gång serien har glidit ett steg.
    const fram = (dt: number) => {
      t += dt;
      if (!stilla) {
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
      // Utan rörelse ritas bara om när något har ändrats: storleken eller musens lampa.
      if (stilla && !andrad) return;
      andrad = false;
      rita();
      if (t >= INTRO_SLUT && ut && !ut.dataset.pa) skriv();
    };

    mat();
    skriv();

    // Bara en mus är en lampa, och bara mellan raden ovanför loggan och rubriken.
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
      <div aria-hidden className="pst1-ton" />
      <canvas ref={grundRef} aria-hidden className="pst1-grund" />
      <canvas ref={ref} aria-hidden className="pst1-duk" />
    </>
  );
}
