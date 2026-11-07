export { clsx as cn } from "clsx";

/** "e-STIG" och "eSTIG" är samma sak: används för att inte visa samma namn två gånger. */
export const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9åäö]/g, "");

export function slugify(input: string): string {
  return slugifyWhileTyping(input).replace(/-+$/, "");
}

/** Som slugify men behåller ett avslutande bindestreck, så att "a-b" går att skriva tecken för tecken. */
export function slugifyWhileTyping(input: string): string {
  return input
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Deterministisk hash → används för generativ grafik (omslag, avatarer). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stripMarkdown(md: string, max = 180): string {
  const text = md
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function safeExternalUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://example.invalid");
    if (u.origin === "https://example.invalid") return url.startsWith("/") ? url : null;
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Teckenstorlek för stora rubriker som anpassas efter längsta ordet, så att
 * långa svenska sammansättningar ("Mottagningsgasque") inte bryts mitt i ordet. Rubriken ska ligga i en behållare med
 * klassen @container: storleken följer då spaltens bredd, som till skillnad från skärmen slutar växa vid sidans maxbredd.
 * charWidth = teckenbredd i em för rubriker i andra stilar än "display". Utan den räknas ordet bokstav för bokstav.
 * enRad = en rubrik med flera ord som bara är lite för lång för raden krymper så att den står på en rad. Annars kan den brytas med
 * Archivo men inte med den något smalare reservfonten, och då hoppar sidan när Archivo kommer.
 */
export function fitHeading(text: string, opts: { maxRem: number; maxVw: number; charWidth?: number; enRad?: boolean }) {
  const words = text.split(/[\s\u00ad-]+/).filter(Boolean);
  const widest = Math.max(4 * DISPLAY_AVERAGE, ...words.map((word) => wordWidth(word, opts.charWidth)));
  // 3 % marginal för reservfonten och för att webbläsaren avrundar. cqi är spaltens bredd, så det gäller på alla skärmar.
  const cqi = 100 / (widest * 1.03);
  const size = `clamp(1.1rem, min(${opts.maxVw}vw, ${cqi.toFixed(2)}cqi), ${opts.maxRem}rem)`;
  if (!opts.enRad || words.length < 2) return { fontSize: size };
  // Hela raden med 5 % marginal, eftersom reservfonten är upp till 2,5 % bredare än Archivo för vissa ord.
  const line = lineWidth(text, opts.charWidth) * 1.05;
  // Är rubriken högst 15 % för lång för raden får den storleken som gör att den ryms på en rad. Är den längre bryts den som förut.
  // Det andra ledet väljer: skillnaden mellan rubrikens bredd och 115 % av raden, gånger ett stort tal och begränsad till mellan 0
  // och storleken. Det blir 0 när rubriken ska stå på en rad och hela storleken när den ska brytas.
  const lang = `clamp(0px, (${size} * ${line.toFixed(3)} - 115cqi) * 1000, ${size})`;
  return { fontSize: `max(min(${size}, ${(100 / line).toFixed(2)}cqi), ${lang})` };
}

/** Hela rubrikens bredd i em på en rad, med mellanslagen. */
function lineWidth(text: string, charWidth?: number) {
  const words = text.replace(/\u00ad/g, "").trim().split(/\s+/);
  return words.reduce((sum, word) => sum + wordWidth(word, charWidth), 0) + (words.length - 1) * (charWidth ?? DISPLAY_SPACE);
}

/** Bokstävernas bredd i em i rubrikstilen "display" (Archivo 125 %, vikt 800, versaler), uppmätt. */
const DISPLAY_WIDTHS: Record<string, number> = {
  A: 0.91, B: 0.89, C: 0.92, D: 0.91, E: 0.84, F: 0.78, G: 0.99, H: 0.97, I: 0.35, J: 0.71, K: 0.93, L: 0.73, M: 1.13, N: 0.97, O: 0.99,
  P: 0.84, Q: 0.99, R: 0.91, S: 0.85, T: 0.83, U: 0.95, V: 0.88, W: 1.19, X: 0.92, Y: 0.9, Z: 0.84, Å: 0.91, Ä: 0.91, Ö: 0.99,
};
const DISPLAY_AVERAGE = 0.9;
/** Mellanslaget i samma stil, uppmätt till 0,284 em. */
const DISPLAY_SPACE = 0.29;

function wordWidth(word: string, charWidth?: number) {
  if (charWidth) return word.length * charWidth;
  return [...word.toUpperCase()].reduce((sum, ch) => sum + (DISPLAY_WIDTHS[ch] ?? (/[0-9]/.test(ch) ? 0.78 : DISPLAY_AVERAGE)), 0);
}
