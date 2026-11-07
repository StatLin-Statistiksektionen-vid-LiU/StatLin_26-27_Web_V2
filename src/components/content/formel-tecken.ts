/*
 * Tecknen som Mynerve saknar, ritade som streck för hand (formel.tsx), som ≤, √, ∞ och pilarna. Koordinaterna är hundradels em i
 * en ruta som är 1 em hög och täcker radens höjd: y = 0 är 0,775 em över baslinjen och y = 100 är 0,225 em under. Baslinjen är då
 * y = 77,5, x-höjden y = 30,5 och axeln (mitten på − och =) y = 48,5, uppmätt i Mynerve. Varje streck ritas för sig, i ordning.
 */

export type Ritat = { w: number; p: string[]; prickar?: [number, number][] };

const vag = (y: number) => `M 9 ${y + 1} C 17 ${y - 6} 25 ${y - 6} 34 ${y} C 43 ${y + 6} 51 ${y + 6} 59 ${y - 1}`;
const linje = (y: number, x0 = 10, x1 = 59) => `M ${x0} ${y} L ${x1} ${y}`;
/** En cirkel av fyra bågar, medsols från höger. */
const cirkel = (cx: number, cy: number, r: number) => {
  const k = r * 0.5523;
  return `M ${cx + r} ${cy} C ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} C ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} C ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} C ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}`;
};

export const TECKEN: Record<string, Ritat> = {
  leq: { w: 68, p: ["M 59 21 L 10 38 L 59 55", linje(68)] },
  geq: { w: 68, p: ["M 10 21 L 59 38 L 10 55", linje(68)] },
  neq: { w: 68, p: [linje(38.5), linje(57.5), "M 44 22 L 25 74"] },
  approx: { w: 68, p: [vag(40), vag(57)] },
  sim: { w: 68, p: [vag(48.5)] },
  simeq: { w: 68, p: [vag(40), linje(59)] },
  cong: { w: 68, p: [vag(32), linje(47), linje(62)] },
  equiv: { w: 68, p: [linje(35), linje(48.5), linje(62)] },
  propto: { w: 70, p: ["M 61 37 C 51 33 43 37 36 48.5 C 29 60 14 61 12 50 C 10 39 27 38 36 49 C 43 59 51 63 61 60"] },
  in: { w: 66, p: ["M 58 25 L 38 25 C 20 25 11 36 11 48.5 C 11 61 20 72 38 72 L 58 72", "M 11 48.5 L 50 48.5"] },
  notin: { w: 66, p: ["M 58 25 L 38 25 C 20 25 11 36 11 48.5 C 11 61 20 72 38 72 L 58 72", "M 11 48.5 L 50 48.5", "M 46 15 L 23 82"] },
  ni: { w: 66, p: ["M 10 25 L 30 25 C 48 25 57 36 57 48.5 C 57 61 48 72 30 72 L 10 72", "M 57 48.5 L 18 48.5"] },
  subset: { w: 66, p: ["M 58 25 L 36 25 C 19 25 11 36 11 48.5 C 11 61 19 72 36 72 L 58 72"] },
  subseteq: { w: 66, p: ["M 58 17 L 36 17 C 19 17 11 27 11 38.5 C 11 50 19 60 36 60 L 58 60", linje(72, 11, 58)] },
  supset: { w: 66, p: ["M 10 25 L 32 25 C 49 25 57 36 57 48.5 C 57 61 49 72 32 72 L 10 72"] },
  supseteq: { w: 66, p: ["M 10 17 L 32 17 C 49 17 57 27 57 38.5 C 57 50 49 60 32 60 L 10 60", linje(72, 10, 57)] },
  to: { w: 82, p: ["M 7 48.5 L 73 48.5", "M 60 38 L 74 48.5 L 60 59"] },
  leftarrow: { w: 82, p: ["M 75 48.5 L 9 48.5", "M 22 38 L 8 48.5 L 22 59"] },
  leftrightarrow: { w: 86, p: ["M 9 48.5 L 77 48.5", "M 22 38 L 8 48.5 L 22 59", "M 64 38 L 78 48.5 L 64 59"] },
  Rightarrow: { w: 84, p: ["M 7 41 L 66 41", "M 7 56 L 66 56", "M 57 30 L 76 48.5 L 57 67"] },
  Leftarrow: { w: 84, p: ["M 77 41 L 18 41", "M 77 56 L 18 56", "M 27 30 L 8 48.5 L 27 67"] },
  Leftrightarrow: { w: 96, p: ["M 18 41 L 78 41", "M 18 56 L 78 56", "M 27 30 L 8 48.5 L 27 67", "M 69 30 L 88 48.5 L 69 67"] },
  mapsto: { w: 84, p: ["M 8 38 L 8 59", "M 8 48.5 L 75 48.5", "M 62 38 L 76 48.5 L 62 59"] },
  longrightarrow: { w: 120, p: ["M 7 48.5 L 111 48.5", "M 98 38 L 112 48.5 L 98 59"] },
  perp: { w: 66, p: ["M 34 20 L 34 74", "M 9 74 L 59 74"] },
  Vert: { w: 38, p: ["M 13 0 L 13 92", "M 26 0 L 26 92"] },
  ll: { w: 80, p: ["M 42 26 L 9 48.5 L 42 71", "M 70 26 L 37 48.5 L 70 71"] },
  gg: { w: 80, p: ["M 10 26 L 43 48.5 L 10 71", "M 38 26 L 71 48.5 L 38 71"] },
  mp: { w: 64, p: ["M 10 20 L 56 20", "M 33 38 L 33 74", "M 10 56 L 56 56"] },
  circ: { w: 46, p: [cirkel(23, 48.5, 10)] },
  cup: { w: 68, p: ["M 12 25 L 12 52 C 12 79 56 79 56 52 L 56 25"] },
  cap: { w: 68, p: ["M 12 72 L 12 45 C 12 18 56 18 56 45 L 56 72"] },
  setminus: { w: 52, p: ["M 12 6 L 40 90"] },
  land: { w: 62, p: ["M 10 72 L 31 25 L 52 72"] },
  lor: { w: 62, p: ["M 10 25 L 31 72 L 52 25"] },
  infty: { w: 86, p: ["M 43 48.5 C 51 31 77 31 77 48.5 C 77 66 51 66 43 48.5 C 35 31 9 31 9 48.5 C 9 66 35 66 43 48.5"] },
  partial: { w: 60, p: ["M 16 19 C 24 7 43 7 48 27 C 53 49 46 77 28 77 C 15 77 10 67 12 58 C 14 48 27 42 39 46 C 45 48 48 52 49 56"] },
  nabla: { w: 68, p: ["M 9 12 L 59 12 L 34 77.5 Z"] },
  forall: { w: 64, p: ["M 9 12 L 32 77 L 55 12", "M 17 47 L 47 47"] },
  exists: { w: 58, p: ["M 11 12 L 47 12 L 47 77 L 11 77", "M 18 44.5 L 47 44.5"] },
  nexists: { w: 58, p: ["M 11 12 L 47 12 L 47 77 L 11 77", "M 18 44.5 L 47 44.5", "M 41 3 L 17 86"] },
  emptyset: { w: 68, p: [cirkel(34, 44, 26), "M 12 80 L 56 8"] },
  vdots: { w: 32, p: [], prickar: [[16, 14], [16, 41], [16, 68]] },
  ddots: { w: 62, p: [], prickar: [[12, 14], [31, 41], [50, 68]] },
  langle: { w: 40, p: ["M 32 0 L 10 46 L 32 92"] },
  rangle: { w: 40, p: ["M 9 0 L 31 46 L 9 92"] },
  lfloor: { w: 40, p: ["M 14 0 L 14 90 L 34 90"] },
  rfloor: { w: 40, p: ["M 26 0 L 26 90 L 6 90"] },
  lceil: { w: 40, p: ["M 14 90 L 14 0 L 34 0"] },
  rceil: { w: 40, p: ["M 26 90 L 26 0 L 6 0"] },
};

/** Integraltecknet i en ruta som är hu hög, med början dx från vänster. */
const integral = (hu: number, dx: number) =>
  `M ${44 + dx} ${hu * 0.1} C ${40 + dx} ${hu * 0.015} ${29 + dx} ${hu * 0.02} ${28 + dx} ${hu * 0.14} C ${27 + dx} ${hu * 0.4} ${27 + dx} ${hu * 0.6} ${26 + dx} ${hu * 0.86} C ${25 + dx} ${hu * 0.98} ${14 + dx} ${hu * 0.985} ${10 + dx} ${hu * 0.9}`;

/** De stora tecknen som Mynerve saknar (Σ och Π har typsnittet), i en ruta som är hu hundradels em hög. */
export function storaTecken(namn: string, hu: number): Ritat | null {
  switch (namn) {
    case "int":
      return { w: 54, p: [integral(hu, 0)] };
    case "iint":
      return { w: 74, p: [integral(hu, 0), integral(hu, 20)] };
    case "iiint":
      return { w: 94, p: [integral(hu, 0), integral(hu, 20), integral(hu, 40)] };
    case "oint":
      return { w: 54, p: [integral(hu, 0), cirkel(27, hu * 0.5, 10)] };
    case "bigcup":
      return { w: 84, p: [`M 14 ${hu * 0.16} L 14 ${hu * 0.58} C 14 ${hu * 0.92} 70 ${hu * 0.92} 70 ${hu * 0.58} L 70 ${hu * 0.16}`] };
    case "bigcap":
      return { w: 84, p: [`M 14 ${hu * 0.84} L 14 ${hu * 0.42} C 14 ${hu * 0.08} 70 ${hu * 0.08} 70 ${hu * 0.42} L 70 ${hu * 0.84}`] };
    default:
      return null;
  }
}

/** Parenteser och andra avgränsare som växer med innehållet, hu hundradels em höga. */
export function avgransare(s: string, hu: number): Ritat | null {
  const w = Math.round(34 + Math.max(0, hu - 100) * 0.06);
  const t = 2;
  const b = hu - 2;
  switch (s) {
    case "(":
      return { w, p: [`M ${w - 6} ${t} C 4 ${hu * 0.28} 4 ${hu * 0.72} ${w - 6} ${b}`] };
    case ")":
      return { w, p: [`M 6 ${t} C ${w - 4} ${hu * 0.28} ${w - 4} ${hu * 0.72} 6 ${b}`] };
    case "[":
      return { w, p: [`M ${w - 5} ${t} L 12 ${t} L 12 ${b} L ${w - 5} ${b}`] };
    case "]":
      return { w, p: [`M 5 ${t} L ${w - 12} ${t} L ${w - 12} ${b} L 5 ${b}`] };
    case "{": {
      const v = w + 8;
      return { w: v, p: [`M ${v - 5} ${t} C ${v * 0.35} ${t} ${v * 0.62} ${hu * 0.48} 6 ${hu * 0.5} C ${v * 0.62} ${hu * 0.52} ${v * 0.35} ${b} ${v - 5} ${b}`] };
    }
    case "}": {
      const v = w + 8;
      return { w: v, p: [`M 5 ${t} C ${v * 0.65} ${t} ${v * 0.38} ${hu * 0.48} ${v - 6} ${hu * 0.5} C ${v * 0.38} ${hu * 0.52} ${v * 0.65} ${b} 5 ${b}`] };
    }
    case "|":
      return { w: 26, p: [`M 13 ${t} L 13 ${b}`] };
    case "‖":
      return { w: 38, p: [`M 13 ${t} L 13 ${b}`, `M 26 ${t} L 26 ${b}`] };
    case "⟨":
      return { w, p: [`M ${w - 6} ${t} L 8 ${hu / 2} L ${w - 6} ${b}`] };
    case "⟩":
      return { w, p: [`M 6 ${t} L ${w - 8} ${hu / 2} L 6 ${b}`] };
    case "⌊":
      return { w, p: [`M 12 ${t} L 12 ${b} L ${w - 5} ${b}`] };
    case "⌋":
      return { w, p: [`M ${w - 12} ${t} L ${w - 12} ${b} L 5 ${b}`] };
    case "⌈":
      return { w, p: [`M 12 ${b} L 12 ${t} L ${w - 5} ${t}`] };
    case "⌉":
      return { w, p: [`M ${w - 12} ${b} L ${w - 12} ${t} L 5 ${t}`] };
    case "/":
      return { w, p: [`M ${w - 6} ${t} L 6 ${b}`] };
    case "\\":
      return { w, p: [`M 6 ${t} L ${w - 6} ${b}`] };
    default:
      return null;
  }
}

/** Accenterna ovanför en bokstav, i egna små rutor (w × h hundradels em). */
export const ACCENTER = {
  hat: { w: 40, h: 18, p: ["M 6 15 L 20 3 L 34 15"] },
  tilde: { w: 44, h: 14, p: ["M 5 10 C 11 2 17 2 22 7 C 27 12 33 12 39 4"] },
  check: { w: 36, h: 16, p: ["M 6 3 L 18 13 L 30 3"] },
  vec: { w: 16, h: 18, p: ["M 4 3 L 13 9 L 4 15"] },
  dot: { w: 14, h: 14, p: [], prickar: [[7, 7]] as [number, number][] },
  ddot: { w: 34, h: 14, p: [], prickar: [[8, 7], [26, 7]] as [number, number][] },
  inte: { w: 50, h: 90, p: ["M 38 6 L 12 84"] },
} satisfies Record<string, { w: number; h: number; p: string[]; prickar?: [number, number][] }>;

/** Ungefär hur långt ett streck är, i samma enheter som koordinaterna. Räcker för att ge längre streck mer tid. */
export function strackLangd(d: string): number {
  const tal = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let kmd = "M";
  let langd = 0;
  const las = () => parseFloat(tal[i++]);
  const avst = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
  while (i < tal.length) {
    if (/[MLCQZ]/.test(tal[i])) kmd = tal[i++];
    if (kmd === "Z") {
      langd += avst(x, y, sx, sy);
      x = sx;
      y = sy;
      kmd = "M";
      continue;
    }
    if (kmd === "M") {
      x = sx = las();
      y = sy = las();
      kmd = "L";
    } else if (kmd === "L") {
      const nx = las();
      const ny = las();
      langd += avst(x, y, nx, ny);
      x = nx;
      y = ny;
    } else if (kmd === "C" || kmd === "Q") {
      const p = kmd === "C" ? [las(), las(), las(), las(), las(), las()] : [las(), las(), las(), las()];
      const ex = p[p.length - 2];
      const ey = p[p.length - 1];
      let poly = 0;
      let px = x;
      let py = y;
      for (let j = 0; j < p.length; j += 2) {
        poly += avst(px, py, p[j], p[j + 1]);
        px = p[j];
        py = p[j + 1];
      }
      langd += (poly + avst(x, y, ex, ey)) / 2;
      x = ex;
      y = ey;
    } else i++;
  }
  return langd;
}
