"use client";

import { useEffect, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/*
 * Bakgrunden i hero 1 (hero-strom-v1.tsx): rutnätet, StatLin i jätteformat och prickarna från heron före omgörningen, och genom
 * dem en rullande tidsserie med sitt konfidensband, också det därifrån: en svag röd ton som följer vart hack i linjen.
 * Linjen går från heronens ena kant till den andra, och strax innanför högerkanten glider den senaste observationen längs
 * den som en punkt, som förr. I introt ritas linjen först, och sedan kommer punkten.
 * Prickarna är seriens observationer. De kommer in från höger, glider åt vänster i seriens fart och ligger spridda kring seriens
 * glidande medelvärde, så att serien går som en ryggrad genom svärmen. När de har passerat punkten tänds de närmaste i rött.
 * Längre bort glider glesare och svagare prickar långsammare, som en fond. Fonden och rutnätet täcker hela heron, också bakom
 * raden överst och texten nederst, som bakgrunden gjorde före omgörningen. Prickarna viker undan för musen.
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
  /** Seriens glidande medelvärde där observationen föddes, i seriens mått, och avståndet från det i pixlar. */
  mitt: number;
  res: number;
  inne: boolean;
  fart: number;
  r: number;
  a: number;
  /** Pekarens knuff, hur mycket serien har tänt pricken, och läget som ritas. */
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
/**
 * Så många observationer hålls i minnet, vilket räcker till en skärm på drygt 5000 px. De sista är framtiden: serien är
 * redan dragen förbi högerkanten, dit linjen når och där prickarna kommer in.
 */
const PUNKTER = 400;
const FRAMTID = 12;
/** Den observation som är på väg in vid punkten. */
const HI = PUNKTER - 1 - FRAMTID;
/** Processens mjuka tak för avvikelsen, i processens eget mått, och hur många enheter det blir här. */
const TAK = 140;
const AMPLITUD = 5;
const BRUS = 5.5;
/** Diagonalen stiger så många enheter från loggan ut till heronens kant, men aldrig brantare än så här. */
const STIGNING = 6;
const BRANTAST = 0.22;
/** Punkten för den senaste observationen står så många pixlar innanför högerkanten: två steg, som i heron före omgörningen. */
const HUVUD_KANT = 28;
/** Observationernas standardavvikelse kring seriens glidande medelvärde, i enheter, och hur många observationer medelvärdet väger in åt varje håll. */
const SIGMA_GRUND = 0.42;
const SIGMA_VOL = 0.36;
const FONSTER = 5;
/** Prickarna inom så många standardavvikelser från seriens glidande medelvärde är de som tänds. */
const BAND = 2;
/*
 * Konfidensbandet kring linjen, som i heron före omgörningen (data-field.tsx): det följer vart hack i linjen, når lite längre
 * under den än över och blir bredare när serien är orolig. Måtten är pixlar vid 800 px höjd: en fast del och en del per enhet
 * volatilitet. Tonen är starkast överst och tonas ut nedåt: den börjar en bit över linjens högsta ände och slutar en bit under
 * den lägsta, i andelar av heronens höjd.
 */
const BAND_OVER = [20, 10];
const BAND_UNDER = [26, 12];
const BAND_ALFA = 0.1;
const BAND_TON = [0.14, 0.2];
/** Under introt tonas bandet in bakom pennan över så många pixlar, i så många steg. */
const BAND_FRAMKANT = 96;
const BAND_STEG = 8;
/** Kring loggan dras serien mot diagonalen, så att loggan står på linjen. */
const FAST_VID_LOGGAN = 0.75;
/** Rutnätets rutor i pixlar, som i heron före omgörningen, och ordet i bakgrunden. */
const RUTA = 64;
const ORD = "STATLIN";
/** Det grå rutnätet tonas ut i en ellips kring heronens mitt. Radien är en andel av heronens bredd och höjd, så att det når kanterna svagt. */
const GRUND_RADIE = 0.57;
/** Utanför bandet mellan raden ovanför loggan och rubriken ligger det rörliga kvar som en svagare fond bakom texten. */
const FOND_STYRKA = 0.7;
/** Fondens prickar: en per så många kvadratpixlar av heron, som i heron före omgörningen, mellan ett minsta och ett största antal. */
const FOND_YTA = 16000;
const FOND_MINST = 14;
const FOND_FLEST = 80;
/** Observationerna kring linjen: en per så många pixlar av heronens bredd, mellan ett minsta och ett största antal. */
const NARA_AVSTAND = 34;
const NARA_MINST = 10;
const NARA_FLEST = 44;
/** Observationerna sprids så många standardavvikelser kring medelvärdet. De inom två tänds, så drygt hälften. */
const SPRIDNING = 2.6;
/** Prickar närmare varandra än så här binds ihop med en linje. */
const LANK = 96;
/** Musen: inom så många pixlar viker prickarna undan, och så långt som mest. */
const VIK = 130;
const KNUFF = 44;
/** Scenen är alltid mörk, så färgerna är fasta: bläck och sektionens röda. */
const INK = "236,235,230";
const ROD = "255,7,7";
/** Introt: pennan ritar serien från vänsterkanten till högerkanten. Sedan kommer punkten: den växer fram, och en ring går ut från den. */
const PENNA_START = 0.25;
const PENNA_TID = 2.1;
const INTRO_SLUT = PENNA_START + PENNA_TID;
const PUNKT_TID = 0.5;
const KRUS_TID = 1.2;
/** Två körningar så nära varandra är Reacts StrictMode, inte en sida som visas igen (se IntroOnce). */
const SAMMA_START_MS = 200;
let spelad = 0;

const mellan = (p: number) => Math.min(1, Math.max(0, p));
const mjuk = (p: number) => {
  const q = mellan(p);
  return q * q * (3 - 2 * q);
};
/** Växer från 0 till 1 och går en aning över 1 på vägen, som en liten studs. */
const studs = (p: number) => {
  const q = mellan(p) - 1;
  return 1 + 2.70158 * q * q * q + 1.70158 * q * q;
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
    const botten = yta?.querySelector<HTMLElement>("[data-pst1-botten]");
    const ut = yta?.querySelector<HTMLElement>("[data-pst1-matt]");
    if (!grund || !b || !c || !g || !yta || !logga || !rad || !botten) return;

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
    /** Seriens glidande medelvärde och observationernas standardavvikelse kring det. */
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
    let typsnitt = false;
    let prickar: Prick[] = [];

    // Tiden sedan starten. Den som kommer tillbaka till sidan slipper introt.
    let t = igen ? INTRO_SLUT + 9 : 0;
    let forskjutning = 0;
    let pek = { x: 0, y: 0 };
    let faste = 0;
    let grepp = 0;

    /** Diagonalens höjd vid läget px, och en avvikelse i pixlar där: mindre kring loggan. */
    const ty = (px: number) => cy - lutning * (px - cx);
    const av = (px: number, dev: number) => skala * dev * (1 - FAST_VID_LOGGAN * Math.exp(-(((px - cx) / (1.25 * ring)) ** 2)));
    const penna = () => (t >= INTRO_SLUT ? Infinity : mjuk((t - PENNA_START) / PENNA_TID) * (xh + 4 * steg));

    /** Läget i heron för ett element, utan transformer: texten nederst och raden ovanför loggan glider in med fade-up. */
    const lage = (el: HTMLElement) => {
      let lx = 0;
      let ly = 0;
      for (let e: HTMLElement | null = el; e && e !== yta; e = e.offsetParent as HTMLElement | null) {
        lx += e.offsetLeft;
        ly += e.offsetTop;
      }
      return [lx, ly];
    };

    /** Sätter en prick på läget px. En observation får sin plats kring seriens medelvärde just där, en prick i fonden var som helst i höjdled. */
    const fodd = (p: Prick, px: number) => {
      p.x = px;
      p.ox = p.oy = p.tand = 0;
      if (p.nara) {
        const i = HI - 1 + forskjutning / steg + (px - xh) / steg;
        const s = u * las(sigma, i);
        p.mitt = las(medel, i);
        p.res = SPRIDNING * s * brus();
        p.inne = Math.abs(p.res) < BAND * s;
      } else {
        p.y = Math.random() * h;
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
          r: nara ? 1.1 + 1.2 * Math.random() : 0.8 + 1.2 * Math.random(),
          a: nara ? 0.36 + 0.4 * Math.random() : 0.14 + 0.28 * Math.random(),
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

    /** Rutnätet och ordet i grått, på grunden. */
    const bakgrund = (x: CanvasRenderingContext2D, duk: HTMLCanvasElement) => {
      duk.width = Math.round(w * skarpa);
      duk.height = Math.round(h * skarpa);
      x.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      x.clearRect(0, 0, w, h);
      // Rutnätets linjer går genom loggans mitt.
      x.fillStyle = `rgba(${INK},0.085)`;
      for (let px = cx % RUTA; px < w; px += RUTA) x.fillRect(Math.round(px), 0, 1, h);
      for (let py = cy % RUTA; py < h; py += RUTA) x.fillRect(0, Math.round(py), w, 1);
      // Det grå rutnätet täcker hela heron, som i heron före omgörningen: tydligast i mitten och uttonat mot kanterna.
      const [rx, ry] = [GRUND_RADIE * w, GRUND_RADIE * h];
      x.save();
      x.globalCompositeOperation = "destination-in";
      x.translate(w / 2, h / 2);
      x.scale(1, ry / rx);
      const ton = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      ton.addColorStop(0.375, "#000");
      ton.addColorStop(1, "#0000");
      x.fillStyle = ton;
      x.fillRect(-w, (-h * rx) / ry, 2 * w, (2 * h * rx) / ry);
      x.restore();
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
      x.lineWidth = 1.5;
      x.strokeStyle = `rgba(${INK},0.1)`;
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
      const in_ = mjuk(t / 1.4);

      // Seriens synliga del, från strax utanför vänsterkanten till strax utanför högerkanten: X och Y är linjen i pixlar och V
      // volatiliteten. Observationen HI - 1 står närmast till vänster om punkten.
      const antal = Math.min(HI - 1, Math.ceil(xh / steg) + 2);
      const forbi = Math.ceil(HUVUD_KANT / steg) + 1;
      const X: number[] = [];
      const Y: number[] = [];
      const V: number[] = [];
      for (let i = HI - 1 - antal; i <= HI - 1 + forbi; i++) {
        const px = xh - (f + HI - 1 - i) * steg;
        X.push(px);
        Y.push(ty(px) - av(px, serie[i].dev));
        V.push(serie[i].vol);
      }
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

      // Introt: pennan går från vänsterkanten till högerkanten, och bandet och linjen syns bara där den har gått.
      const spets = penna();
      // Konfidensbandet: en svag röd ton kring linjen.
      const enhet = h / 800;
      const ton = g.createLinearGradient(0, ty(w) - BAND_TON[0] * h, 0, ty(0) + BAND_TON[1] * h);
      ton.addColorStop(0, `rgba(${ROD},${BAND_ALFA})`);
      ton.addColorStop(1, `rgba(${ROD},0)`);
      const band = new Path2D();
      band.moveTo(X[0], Y[0] - (BAND_OVER[0] + BAND_OVER[1] * V[0]) * enhet);
      for (let i = 1; i <= sist; i++) band.lineTo(X[i], Y[i] - (BAND_OVER[0] + BAND_OVER[1] * V[i]) * enhet);
      for (let i = sist; i >= 0; i--) band.lineTo(X[i], Y[i] + (BAND_UNDER[0] + BAND_UNDER[1] * V[i]) * enhet);
      band.closePath();
      g.fillStyle = ton;
      if (spets < Infinity) {
        // Under introt tonas bandet in i steg bakom pennan, så att det inte slutar med en tvär kant.
        const fyll = (fran: number, till: number, alfa: number) => {
          if (till <= Math.max(0, fran)) return;
          g.save();
          g.beginPath();
          g.rect(Math.max(0, fran), 0, till - Math.max(0, fran), h);
          g.clip();
          g.globalAlpha = alfa;
          g.fill(band);
          g.restore();
        };
        const bak = Math.floor(spets) - BAND_FRAMKANT;
        const del = BAND_FRAMKANT / BAND_STEG;
        fyll(0, bak, 1);
        for (let k = 0; k < BAND_STEG; k++) fyll(bak + k * del, bak + (k + 1) * del, 1 - (k + 0.5) / BAND_STEG);
      } else {
        g.globalAlpha = 1;
        g.fill(band);
      }

      // Prickarna: grå, och röda i den mån serien har tänt dem.
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

      // Den senaste observationen: en punkt som glider längs linjen strax innanför högerkanten. Den kommer när pennan har
      // ritat linjen: den växer fram med en liten studs, och en ring går ut från den, en gång.
      const sedan = t - INTRO_SLUT;
      if (sedan <= 0) return;
      const hy = vid(xh, Y);
      g.fillStyle = g.strokeStyle = `rgb(${ROD})`;
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(xh, hy, 3.5 * studs(sedan / PUNKT_TID), 0, 7);
      g.fill();
      const krus = sedan / KRUS_TID;
      if (krus < 1) {
        g.lineWidth = 1.25;
        g.globalAlpha = 0.55 * (1 - krus);
        g.beginPath();
        g.arc(xh, hy, 4 + 20 * mjuk(krus), 0, 7);
        g.stroke();
        g.globalAlpha = 1;
      }
    };

    /** Prickarnas knuff från pekaren, hur serien tänder dem och läget som ritas. */
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
      c.width = Math.round(w * skarpa);
      c.height = Math.round(h * skarpa);
      g.setTransform(skarpa, 0, 0, skarpa, 0, 0);
      // Loggans mitt räknat från heronens hörn, och ringens radie.
      ring = logga.offsetWidth * RING;
      u = ring / 7.5;
      const [lx, ly] = lage(logga);
      cx = lx + logga.offsetWidth / 2;
      cy = ly + logga.offsetHeight / 2;
      xh = w - HUVUD_KANT;
      lutning = Math.min(BRANTAST, (STIGNING * u) / Math.max(cx, w - cx));
      skala = (AMPLITUD * u) / TAK;
      steg = grov ? STEG_TELEFON : STEG;
      zonTopp = lage(rad)[1] + rad.offsetHeight;
      zonBotten = lage(botten)[1];
      yta.style.setProperty("--lx", `${cx}px`);
      yta.style.setProperty("--ly", `${cy}px`);

      bakgrund(b, grund);
      // Grunden visas först när ordets typsnitt har kommit, så att det inte byter form inför ögonen.
      if (typsnitt) yta.dataset.rutat = "";

      // Det rörliga är starkast mellan raden ovanför loggan och texten nederst. Utanför ligger det kvar som en svagare fond
      // bakom texten, och det tonas ut mot heronens nederkant. Åt sidorna går det ända ut, så att linjen når båda kanterna.
      // Rutnätet har sin egen toning, se bakgrund.
      const svag = `rgb(0 0 0 / ${FOND_STYRKA})`;
      const v = `linear-gradient(${svag} ${zonTopp}px, #000 ${zonTopp + 2.5 * u}px, #000 ${zonBotten - 2.5 * u}px, ${svag} ${zonBotten}px)`;
      c.style.maskImage = `${v}, linear-gradient(#000 calc(100% - 5rem), #0000)`;

      // Prickarna sås om när heron har bytt storlek: observationerna efter heronens bredd, färre på telefon, och fonden efter dess yta.
      if (Math.abs(w - forrW) > 1 || Math.abs(h - forrH) > 1 || !prickar.length) {
        const tathet = grov ? 0.6 : 1;
        sa(Math.round(tathet * Math.min(NARA_FLEST, Math.max(NARA_MINST, w / NARA_AVSTAND))), Math.round(Math.min(FOND_FLEST, Math.max(FOND_MINST, (w * h) / FOND_YTA))));
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

    // Prickarna viker bara undan för en mus, och bara mellan raden ovanför loggan och texten nederst.
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
