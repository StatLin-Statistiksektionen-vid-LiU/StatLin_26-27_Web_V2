/**
 * Det egna hos varje utskott och post: motivet som ritas runt loggan (src/components/karaktar/) och rubrikerna på utskottets sida.
 * Ett utskott har sin accentfärg, som det ändrar under Vår sida. Styrelsens poster delar utskott och får sin färg här.
 */
import type { CSSProperties } from "react";

export type MotivNamn = "trad" | "skiva" | "vimplar" | "bubblor" | "plan" | "block" | "urtavla" | "klubba" | "protokoll" | "vagor" | "mynt" | "kurva" | "hatt" | "normal";

export type Genvag = { href: string; titel: string; text: string };

/**
 * nasta är rubriken över utskottets närmaste evenemang, och kommande och tidigare rubrikerna över dess evenemang. Genvägarna
 * går till det på sajten som hör till utskottet.
 */
export const UTSKOTT: Record<string, { motiv: MotivNamn; nasta: string; kommande: string; tidigare: string; genvagar?: Genvag[] }> = {
  ubu: {
    motiv: "trad",
    nasta: "Nästa på schemat",
    kommande: "På schemat",
    tidigare: "Avklarat",
    genvagar: [
      { href: "/tentastatistik", titel: "Tentastatistik", text: "Hur tentorna har gått, kurs för kurs." },
      { href: "/studenter/hjalpmedel", titel: "Hjälpmedel", text: "Fusklappar, kod och guider från andra studenter." },
    ],
  },
  sasu: {
    motiv: "skiva",
    nasta: "Nästa möte med arbetslivet",
    kommande: "Möt arbetslivet",
    tidigare: "Tidigare möten",
    genvagar: [
      { href: "/star", titel: "STAR", text: "Sektionens arbetsmarknadsdag." },
      { href: "/lunchforelasningar", titel: "Lunchföreläsningar", text: "Önska ett företag eller ett ämne." },
    ],
  },
  scb: {
    motiv: "vimplar",
    nasta: "Nästa kalas",
    kommande: "Kalaskalendern",
    tidigare: "Kalas vi minns",
    genvagar: [{ href: "/galleri", titel: "Galleri", text: "Bilderna från sittningar och fester." }],
  },
  statpub: { motiv: "bubblor", nasta: "Nästa pub", kommande: "På tapp", tidigare: "Tidigare kvällar" },
  stig: { motiv: "plan", nasta: "Nästa avspark", kommande: "Matchprogrammet", tidigare: "Spelat" },
  estig: { motiv: "block", nasta: "Nästa runda", kommande: "Nästa nivå", tidigare: "Avklarade rundor" },
  amo: { motiv: "urtavla", nasta: "Nästa med AMO", kommande: "På agendan", tidigare: "Tidigare" },
};

/** Styrelsens poster, i den ordning de prövas mot kontots post: vice ordförande före ordförande. */
const POSTER: { passar: RegExp; farg: string; motiv: MotivNamn; smeknamn?: string }[] = [
  { passar: /vice|sekreterare/i, farg: "#2b5fa8", motiv: "protokoll" },
  { passar: /ordförande/i, farg: "#ff0707", motiv: "klubba" },
  { passar: /kassör/i, farg: "#c9a227", motiv: "mynt", smeknamn: "money man" },
  { passar: /information|webb/i, farg: "#e04e1a", motiv: "vagor" },
  { passar: /grafisk/i, farg: "#d6257e", motiv: "kurva" },
  { passar: /master/i, farg: "#0f8a84", motiv: "hatt" },
];

/** Loggans två lager för entrén: bilden utan signaturen, och signaturen (scripts/logglager.mjs). */
export type Logglager = { bild: string; skrift: string };
const MED_LAGER = new Set(["ubu", "sasu", "statpub", "stig", "estig", "amo"]);
const LOGGMAPP = "/brand/utskott";
/*
 * Lagrens version. scripts/logglager.mjs skriver om raden när lagren görs om, så att adresserna byts. Filerna i /brand ligger ett dygn
 * i webbläsarens cache (next.config.ts), och utan versionen visar en webbläsare som har de gamla lagren dem under den nya entrén.
 */
const LAGER_V = "06a50657";

/** Lagren finns för loggorna som följer med sajten. Ett utskott som har laddat upp en egen logga får den hel. */
export const logglager = (slug: string, logo: string | null): Logglager | null =>
  MED_LAGER.has(slug) && logo === `${LOGGMAPP}/${slug}.webp`
    ? { bild: `${LOGGMAPP}/lager/${slug}-bild.webp?v=${LAGER_V}`, skrift: `${LOGGMAPP}/lager/${slug}-skrift.webp?v=${LAGER_V}` }
    : null;

export type Karaktar = { farg: string; motiv: MotivNamn; smeknamn?: string };

/** Kontots karaktär: utskottets för den som har ett eget utskott, annars postens. */
export function karaktarFor(post: string, utskott?: { slug: string; accent: string; kind: string } | null): Karaktar {
  if (utskott && utskott.kind !== "styrelse") return { farg: utskott.accent, motiv: UTSKOTT[utskott.slug]?.motiv ?? "normal" };
  return POSTER.find((p) => p.passar.test(post)) ?? { farg: "#ff0707", motiv: "normal" };
}

/**
 * Den egna färgen som CSS-variabler: --egen på papper, --egen-ljus på mörka ytor, som korten i portalen, och --egen-pa för
 * text på en yta i --egen: vit, eller mörk på ljusa färger som StatPubs gula. En nästan svart accent (STIG, AMO) blir bläckets
 * färg, som är mörk i ljust läge och ljus i mörkt, så att den syns i båda.
 */
export function egenFarg(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const syns = /^#[0-9a-f]{6}$/i.test(hex) && r + g + b > 120;
  const ljus = 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
  return {
    "--egen": syns ? hex : "var(--color-ink)",
    "--egen-ljus": syns ? `color-mix(in oklab, ${hex} 62%, white)` : "#ece8df",
    "--egen-pa": syns ? (ljus ? "#111" : "#fff") : "var(--color-paper)",
  } as CSSProperties;
}
