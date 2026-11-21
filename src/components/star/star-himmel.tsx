"use client";

import { useEffect, useRef } from "react";
import { MorkTopp } from "@/components/layout/mork-topp";

const VARV = Math.PI * 2;
/** Stjärnorna tänds i några lager efter varandra. Lagren tonas av grafikkortet, så att det inte hackar medan sidan laddar. */
const LAGER = 5;
const FARGER = ["#f2f5ff", "#f2f5ff", "#f2f5ff", "#cddbff", "#cddbff", "#ffe7cf"];

type Stjarna = { x: number; y: number; r: number; alfa: number; styrka: number; farg: string; ordning: number };
type Toning = "lang" | "kort" | "ingen";

/** Himlen ska tändas långsamt första gången. Går man tillbaka till sidan är det redan natt. */
let tandSedd = false;

/** En liten generator med fast frö: samma himmel varje gång, så att den inte hoppar runt mellan besöken. */
function slumpare(fro: number) {
  let s = fro >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mjuka moln av tätare och glesare stjärnor. Ett jämnt strö ser ut som brus, inte som en himmel. */
function molnfalt(slump: () => number) {
  const N = 9;
  const varden = Array.from({ length: N * N }, () => slump());
  const mjuk = (t: number) => t * t * (3 - 2 * t);
  const punkt = (x: number, y: number) => varden[(y % N) * N + (x % N)];
  return (u: number, v: number) => {
    const x = u * (N - 1);
    const y = v * (N - 1);
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = mjuk(x - xi);
    const fy = mjuk(y - yi);
    const over = punkt(xi, yi) * (1 - fx) + punkt(xi + 1, yi) * fx;
    const under = punkt(xi, yi + 1) * (1 - fx) + punkt(xi + 1, yi + 1) * fx;
    return over * (1 - fy) + under * fy;
  };
}

/** Många svaga och få starka stjärnor, samlade kring ett stråk som går uppför himlen åt höger, som grafen i loggan. */
function skapaHimmel(w: number, h: number) {
  const slump = slumpare(20261208);
  const antal = Math.round(Math.min(1200, Math.max(240, (w * h) / 1600)));
  const lutning = -Math.atan2(h, w) * 0.75;
  const nx = -Math.sin(lutning);
  const ny = Math.cos(lutning);
  const bredd = Math.hypot(w, h) * 0.15;
  const moln = molnfalt(slump);
  const stjarnor: Stjarna[] = [];
  for (let forsok = 0; stjarnor.length < antal && forsok < antal * 12; forsok++) {
    const x = slump() * w;
    const y = slump() * h;
    const avstand = ((x - w / 2) * nx + (y - h / 2) * ny) / bredd;
    const tathet = 0.22 + 0.78 * Math.exp(-avstand * avstand) * (0.3 + 0.7 * moln(x / w, y / h));
    if (slump() > tathet) continue;
    const styrka = Math.pow(slump(), 4.6);
    stjarnor.push({
      x,
      y,
      styrka,
      r: 0.38 + styrka * 1.05,
      alfa: 0.16 + Math.pow(styrka, 0.65) * 0.8,
      farg: FARGER[Math.floor(slump() * FARGER.length)],
      // De starka kommer först, som när det skymmer, men inte i exakt ordning.
      ordning: styrka + (slump() - 0.5) * 0.3,
    });
  }
  return stjarnor;
}

/** De starkaste stjärnorna med lite luft emellan. De blir egna små element som tänds en och en och andas långsamt. */
function valjLjusa(stjarnor: Stjarna[], antal: number, luft: number) {
  const valda: Stjarna[] = [];
  for (const s of [...stjarnor].sort((a, b) => b.styrka - a.styrka)) {
    if (valda.length >= antal) break;
    if (valda.every((v) => Math.hypot(v.x - s.x, v.y - s.y) > luft)) valda.push(s);
  }
  return valda;
}

function ritaStjarnor(ctx: CanvasRenderingContext2D, stjarnor: Stjarna[]) {
  for (const s of stjarnor) {
    if (s.styrka > 0.5) {
      const radie = s.r * 5;
      const sken = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radie);
      sken.addColorStop(0, s.farg);
      sken.addColorStop(1, "transparent");
      ctx.globalAlpha = s.alfa * 0.16;
      ctx.fillStyle = sken;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radie, 0, VARV);
      ctx.fill();
    }
    ctx.globalAlpha = s.alfa;
    ctx.fillStyle = s.farg;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, VARV);
    ctx.fill();
  }
}

/**
 * Natthimlen bakom STAR-sidan: stjärnorna kommer fram när sidan öppnas, och då och då faller en stjärna. Efter att himlen tänts ritas
 * ingenting mer, så scrollningen kostar lika lite som över en stillbild. Stjärnfallet och de få stjärnor som andas är bara transform
 * och opacitet på små element. Utan JavaScript syns den enklare himlen i bakgrunden. Himlen tänds och rör sig också för den som
 * har valt bort rörelse i sin enhet, som startsidans hero: sektionen vill ha det så. Sidans text står still för dem.
 */
export function StarHimmel() {
  const ytaRef = useRef<HTMLDivElement>(null);
  const fallRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const yta = ytaRef.current;
    const fall = fallRef.current;
    if (!yta || !fall) return;
    let bredd = 0;
    let hojd = 0;
    let klar: ReturnType<typeof setTimeout> | undefined;

    const rita = (toning: Toning) => {
      clearTimeout(klar);
      yta.replaceChildren();
      // Tak för antalet bildpunkter: en stor skärm med hög upplösning ska inte behöva hundratals megabyte för några stjärnor.
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6_000_000 / (bredd * hojd)));
      const stjarnor = skapaHimmel(bredd, hojd);
      const ljusa = valjLjusa(stjarnor, bredd < 768 ? 7 : 14, Math.hypot(bredd, hojd) * 0.11);
      const rest = stjarnor.filter((s) => !ljusa.includes(s)).sort((a, b) => b.ordning - a.ordning);
      const antalLager = toning === "lang" ? LAGER : 1;
      const dukar: HTMLCanvasElement[] = [];
      for (let i = 0; i < antalLager; i++) {
        const duk = document.createElement("canvas");
        duk.width = Math.round(bredd * dpr);
        duk.height = Math.round(hojd * dpr);
        const ctx = duk.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ritaStjarnor(ctx, rest.slice(Math.floor((rest.length * i) / antalLager), Math.floor((rest.length * (i + 1)) / antalLager)));
        if (toning !== "ingen") {
          duk.dataset.tand = "";
          duk.style.setProperty("--d", toning === "lang" ? `${0.5 + i * 0.42}s` : "0s");
          duk.style.setProperty("--t", toning === "lang" ? `${1.4 + i * 0.25}s` : "0.6s");
        }
        yta.append(duk);
        dukar.push(duk);
      }
      ljusa.forEach((s, i) => {
        const ljus = document.createElement("span");
        ljus.className = "star-ljus";
        ljus.style.left = `${(s.x / bredd) * 100}%`;
        ljus.style.top = `${(s.y / hojd) * 100}%`;
        ljus.style.setProperty("--s", `${Math.round(8 + s.styrka * 6)}px`);
        ljus.style.setProperty("--d", toning === "lang" ? `${0.15 + (i * 1.7) / ljusa.length}s` : "0s");
        ljus.style.setProperty("--t", `${5 + ((i * 7) % 8)}s`);
        ljus.append(document.createElement("span"));
        yta.append(ljus);
      });
      // När himlen är tänd behövs inte lagren längre: de blir en enda bild, så att scrollningen inte har fler ytor än nödvändigt att lägga ihop.
      if (toning === "lang") {
        klar = setTimeout(() => {
          const ctx = dukar[0].getContext("2d");
          ctx?.setTransform(1, 0, 0, 1, 0, 0);
          for (const duk of dukar.slice(1)) {
            ctx?.drawImage(duk, 0, 0);
            duk.remove();
          }
          tandSedd = true;
        }, 5000);
      }
    };

    const skjut = () => {
      if (document.hidden || !bredd) return;
      const diagonal = Math.hypot(bredd, hojd);
      const stor = Math.random() < 0.2;
      const x = bredd * (0.1 + Math.random() * 0.85);
      const y = hojd * (0.02 + Math.random() * 0.5);
      // Stjärnfall i samma svärm kommer från samma punkt på himlen, här snett ovanför högra kanten. Det ger riktningarna ett sammanhang.
      const vinkel = Math.atan2(y + hojd * 0.3, x - bredd * 1.2);
      const strack = diagonal * (stor ? 0.42 : 0.24 + Math.random() * 0.1);
      const ms = Math.round((strack / (diagonal * 0.42)) * 1000);
      const svans = fall.firstElementChild as HTMLElement;
      svans.style.width = `${Math.round(Math.min(strack * 0.6, stor ? 340 : 240))}px`;
      const fran = `translate(${x}px, ${y}px) rotate(${vinkel}rad)`;
      const till = `translate(${x + Math.cos(vinkel) * strack}px, ${y + Math.sin(vinkel) * strack}px) rotate(${vinkel}rad)`;
      const ljus = stor ? 1 : 0.72;
      fall.animate(
        [
          { transform: fran, opacity: 0 },
          { opacity: ljus, offset: 0.12 },
          { opacity: ljus * 0.9, offset: 0.68 },
          { transform: till, opacity: 0 },
        ],
        { duration: ms, easing: "cubic-bezier(0.25, 0.4, 0.6, 1)" },
      );
      svans.animate([{ transform: "scaleX(0.04)" }, { transform: "scaleX(1)", offset: 0.6 }, { transform: "scaleX(0.75)" }], { duration: ms });
    };

    let tid: ReturnType<typeof setTimeout> | undefined;
    const planera = (ms: number) => {
      tid = setTimeout(() => {
        skjut();
        const telefon = bredd < 768;
        // Oftast en stund emellan, någon enstaka gång två tätt efter varandra.
        planera(Math.random() < 0.12 ? 1400 + Math.random() * 1200 : (telefon ? 9000 : 7000) + Math.random() * (telefon ? 15000 : 13000));
      }, ms);
    };
    planera(tandSedd ? 3000 : 4500 + Math.random() * 1500);

    // Bara när storleken verkligen ändras: 100lvh står stilla när adressfältet på telefonen försvinner. Dold sida har storleken noll.
    let vantar: ReturnType<typeof setTimeout> | undefined;
    const matt = new ResizeObserver(() => {
      const w = yta.clientWidth;
      const h = yta.clientHeight;
      if (!w || !h || (w === bredd && h === hojd)) return;
      const forsta = !bredd;
      bredd = w;
      hojd = h;
      clearTimeout(vantar);
      if (forsta) rita(tandSedd ? "kort" : "lang");
      else vantar = setTimeout(() => rita("ingen"), 200);
    });
    matt.observe(yta);

    return () => {
      matt.disconnect();
      clearTimeout(tid);
      clearTimeout(klar);
      clearTimeout(vantar);
      yta.replaceChildren();
    };
  }, []);

  return (
    <div className="star-himmel" aria-hidden>
      {/* Himlen är mörk i båda lägena, så listen överst får mörka lägets färger över den. */}
      <MorkTopp />
      <noscript>
        <div className="star-himmel-reserv" />
      </noscript>
      <div ref={ytaRef} className="star-himmel-yta" />
      <span ref={fallRef} className="star-stjarnfall">
        <i />
      </span>
    </div>
  );
}
