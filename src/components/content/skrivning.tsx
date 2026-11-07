"use client";

import { Fragment, useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";

/*
 * Text som skrivs fram för hand. Används av handskrift.tsx (anteckningen vid loggan och citaten i sidfoten) och av ForHand nedan,
 * det som står _så här_ i de redigerbara texterna (accent-text.tsx). Orden visas ett i taget från vänster till höger med clip-path,
 * i den takt de skulle skrivas. Lägena står i data-skriv och sätts här direkt på elementet:
 *   inget  dolt, i ett vanligt typsnitt skalat till Mynerves mått, och Mynerve är inte hämtat (det hämtas när texten närmar sig skärmen),
 *   laddar typsnittet hämtas,
 *   skriver animationerna går,
 *   klar   allt syns.
 * Utan JavaScript syns texten direkt. Med reducerad rörelse, i redigeringsläget och när texten redan skrivits en gång sedan sidan
 * laddades blir den klar direkt. Lägena och animationerna står under .handskrift i globals.css.
 */

type Del = { s: string; typ?: "sub" | "sup" | "streck" };
export type Ord = { delar: Del[]; d: number; t: number };

/**
 * _x eller _{xy} blir index och ^x eller ^{xy} exponent, eftersom typsnittet saknar de små siffrorna. Ett streck över en bokstav,
 * som i x̄ (U+0304), ritas för sig (.hs-streck), eftersom Mynerve lägger strecket bredvid bokstaven.
 */
function tolka(ord: string): Del[] {
  const delar: Del[] = [];
  let i = 0;
  for (const m of ord.matchAll(/([_^])(?:\{([^}]*)\}|(.))|(\P{M})̄/gu)) {
    if (m.index > i) delar.push({ s: ord.slice(i, m.index) });
    if (m[4]) delar.push({ s: m[4], typ: "streck" });
    else delar.push({ s: m[2] ?? m[3], typ: m[1] === "_" ? "sub" : "sup" });
    i = m.index + m[0].length;
  }
  if (i < ord.length) delar.push({ s: ord.slice(i) });
  return delar;
}

/** Orden med när de börjar och hur länge de skrivs, i millisekunder från start. slut är när sista ordet är skrivet. */
export function forbered(text: string, start: number, perTecken: number, paus: number) {
  let tid = start;
  const ord: Ord[] = text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const delar = tolka(w);
      const t = Math.max(1, delar.reduce((n, d) => n + [...d.s].length, 0)) * perTecken;
      const o = { delar, d: tid, t };
      tid += t + paus;
      return o;
    });
  return { ord, slut: ord.length ? tid - paus : start };
}

export function Orden({ ord }: { ord: Ord[] }) {
  return ord.map((o, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="hs-ord" style={{ "--d": o.d, "--t": o.t } as CSSProperties}>
        {o.delar.map((d, j) =>
          d.typ === "sub" ? (
            <sub key={j}>{d.s}</sub>
          ) : d.typ === "sup" ? (
            <sup key={j}>{d.s}</sup>
          ) : d.typ === "streck" ? (
            <span key={j} className="hs-streck">
              {d.s}
            </span>
          ) : (
            d.s
          ),
        )}
      </span>
    </Fragment>
  ));
}

/** Det som skrivits sedan sidan laddades. Modulen lever tills sidan laddas om, så en bakåtnavigering skriver inte om texten. */
const skrivna = new Set<string>();

/**
 * Skriver fram texten när den syns. nyckel identifierar texten, stilla gör den klar direkt, fordrojning väntar efter att den
 * syns (heron hinner spela sitt intro) och langd är när allt, strecken också, är klart.
 */
export function useSkrivning<T extends HTMLElement>(nyckel: string, prov: string, stilla: boolean, fordrojning: number, langd: number) {
  const ref = useRef<T>(null);
  // Före målningen, så att det som redan är skrivet inte hinner visas dolt när sidan kommer tillbaka.
  useLayoutEffect(() => {
    // Det som syns i redigeringsläget räknas som skrivet, så att det inte skrivs om när läget stängs av.
    if (stilla) skrivna.add(nyckel);
    const el = ref.current;
    if (!el) return;
    const satt = (lage: string) => (el.dataset.skriv = lage);
    if (skrivna.has(nyckel)) {
      satt("klar");
      return;
    }
    // Med reducerad rörelse visas texten som den är, men typsnittet hämtas ändå först när texten är nära.
    const lugn = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let laddad = false;
    let synlig = lugn;
    let startad = false;
    const timers: number[] = [];
    const starta = () => {
      if (!laddad || !synlig || startad) return;
      startad = true;
      skrivna.add(nyckel);
      if (lugn) return satt("klar");
      // Fördröjningen räknas från att sidan visades. Kommer texten i bild senare skrivs den direkt.
      const vanta = Math.max(0, fordrojning - (performance.now() - t0));
      timers.push(window.setTimeout(() => satt("skriver"), vanta));
      timers.push(window.setTimeout(() => satt("klar"), vanta + langd + 150));
    };
    // Typsnittet hämtas när texten är på väg in i bild, inte på varje sida som har en sidfot.
    const nara = new IntersectionObserver(
      (poster) => {
        if (!poster.some((p) => p.isIntersecting)) return;
        nara.disconnect();
        satt("laddar");
        const klar = () => {
          laddad = true;
          starta();
        };
        Promise.race([document.fonts.load('1em "Mynerve"', prov), new Promise((r) => window.setTimeout(r, 2500))]).then(klar, klar);
      },
      { rootMargin: "400px 0px" },
    );
    const syns = new IntersectionObserver(
      (poster) => {
        if (!poster.some((p) => p.isIntersecting)) return;
        syns.disconnect();
        synlig = true;
        starta();
      },
      { threshold: 0.5 },
    );
    nara.observe(el);
    if (!lugn) syns.observe(el);
    return () => {
      nara.disconnect();
      syns.disconnect();
      for (const t of timers) clearTimeout(t);
      // Avbröts skrivningen (texten ändrades) får den börja om.
      if (startad && el.dataset.skriv !== "klar") skrivna.delete(nyckel);
    };
  }, [nyckel, prov, stilla, fordrojning, langd]);
  return ref;
}

/* ---------- _Så här_ i de redigerbara texterna ---------- */

/** Heron och sidhuvudena hinner tona in innan pennan börjar. Kommer texten i bild senare skrivs den direkt. */
const FORDROJNING = 650;
const PER_TECKEN = 42;
const PAUS = 90;

/**
 * Det som står _så här_ i en redigerbar text (AccentText): handskrivet med bläck, eller rödpenna med rod, och det skrivs fram när det syns. rad är en
 * hel rad för hand, som står för sig och lite snett. stilla visar texten direkt, som i redigeringsläget. plats är en osynlig kopia
 * som bara håller platsen. Den skrivs aldrig och räknas inte som skriven, så att den riktiga texten skrivs fram när den kommer.
 */
export function ForHand({ text, rad, rod, stilla = false, plats }: { text: string; rad?: boolean; rod?: boolean; stilla?: boolean; plats?: boolean }) {
  const { ord, slut } = forbered(text, 0, PER_TECKEN, PAUS);
  if (plats) return <HandVy ord={ord} rad={rad} rod={rod} klar />;
  return <SkrivenHand text={text} ord={ord} slut={slut} rad={rad} rod={rod} stilla={stilla} />;
}

function SkrivenHand({ text, ord, slut, rad, rod, stilla }: { text: string; ord: Ord[]; slut: number; rad?: boolean; rod?: boolean; stilla: boolean }) {
  const ref = useSkrivning<HTMLSpanElement>(`hand:${text}`, text, stilla, FORDROJNING, slut);
  return <HandVy ref={ref} ord={ord} rad={rad} rod={rod} />;
}

/** Bläck, svart eller vitt efter läget, eller rödpenna (rod). */
function HandVy({ ref, ord, rad, rod, klar }: { ref?: Ref<HTMLSpanElement>; ord: Ord[]; rad?: boolean; rod?: boolean; klar?: boolean }) {
  return (
    <span
      ref={ref}
      data-skriv={klar ? "klar" : undefined}
      className={`handskrift hs-penna ${rad ? "hs-rad" : "hs-i-texten"}${rod ? " hs-rod" : ""}`}
    >
      {rad ? (
        <span className="hs-snett">
          <Orden ord={ord} />
        </span>
      ) : (
        <Orden ord={ord} />
      )}
    </span>
  );
}
