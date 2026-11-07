import type { CSSProperties, ReactNode } from "react";
import { cn, hashString, mulberry32 } from "@/lib/utils";

/*
 * Omslagen som ritas när en nyhet eller ett evenemang saknar bild: ett diagram på millimeterpapper, med utskottets logga som
 * ett klistermärke. Motivet väljs efter rubriken (en sittning blir en Poissonfördelning, en kursutvärdering ett histogram) och
 * annars efter nyckeln, så att samma nyhet alltid får samma bild. Bläcket är textfärgen och markeringarna utskottets färg, så
 * båda följer temat (.cover-art i globals.css). Rutnätet är en bakgrund i CSS och kostar inget per omslag; diagrammet är några
 * få banor, eftersom omslaget står både i HTML:en och i sidans RSC-data, ibland nio gånger på en sida.
 */

type Rnd = () => number;
type Pt = [number, number];
type Yta = { x0: number; x1: number; rnd: Rnd; gauss: Rnd };

/** Diagrammets x-axel och överkant i ritytan, som är 400 gånger 250. Under axeln står bildtexten. */
const BAS = 212;
const TOPP = 40;

const t1 = (n: number) => Math.round(n * 10) / 10;
const klamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const linje = (ps: Pt[]) => "M" + ps.map(([x, y]) => `${t1(x)} ${t1(y)}`).join("L");
/** Punkter som streck utan längd: med runda ändar blir de prickar, och alla får plats i en enda bana. */
const prickar = (ps: Pt[]) => ps.map(([x, y]) => `M${t1(x)} ${t1(y)}h0`).join("");
const ring = ([x, y]: Pt, r: number) => `M${t1(x - r)} ${t1(y)}a${t1(r)} ${t1(r)} 0 1 0 ${t1(2 * r)} 0a${t1(r)} ${t1(r)} 0 1 0 ${t1(-2 * r)} 0`;

const STRECK = { fill: "none", stroke: "currentColor" } as const;

/** Färgade delar ritas i utskottets färg (--omslag), allt annat i bläcket. */
function Farg({ children }: { children: ReactNode }) {
  return <g className="omslag-farg">{children}</g>;
}

function Axel({ x0, x1, y = false }: { x0: number; x1: number; y?: boolean }) {
  let d = y ? `M${x0 - 8} ${TOPP}V${BAS}H${x1 + 8}` : `M${x0 - 8} ${BAS}H${x1 + 8}`;
  const steg = (x1 - x0) / 8;
  for (let i = 0; i <= 8; i++) d += `M${t1(x0 + i * steg)} ${BAS}v5`;
  return <path d={d} {...STRECK} strokeOpacity={0.35} strokeWidth={1.2} />;
}

/** Ett ensidigt test: normalfördelningen med svansen bortom det kritiska värdet ifylld. */
function Normal({ x0, x1, rnd }: Yta) {
  const mu = (rnd() - 0.5) * 0.4;
  const h = 132 + rnd() * 26;
  const z = 1.1 + rnd() * 0.8;
  const X = (t: number) => x0 + ((t + 3.4) / 6.8) * (x1 - x0);
  const Y = (t: number) => BAS - h * Math.exp(-((t - mu) ** 2) / 2);
  const kurva: Pt[] = Array.from({ length: 35 }, (_, i) => -3.4 + i * 0.2).map((t) => [X(t), Y(t)]);
  const fran = mu + z;
  const svans: Pt[] = [[X(fran), BAS], ...Array.from({ length: 16 }, (_, i) => fran + ((3.4 - fran) * i) / 15).map((t): Pt => [X(t), Y(t)]), [X(3.4), BAS]];
  return (
    <>
      <Axel x0={x0} x1={x1} />
      <path d={`M${t1(X(mu))} ${BAS}V${t1(Y(mu) - 8)}`} {...STRECK} strokeOpacity={0.35} strokeDasharray="3 4" />
      <Farg>
        <path d={`${linje(kurva)}Z`} fill="currentColor" fillOpacity={0.08} />
        <path d={`${linje(svans)}Z`} fill="currentColor" fillOpacity={0.55} />
        <path d={linje(kurva)} {...STRECK} strokeWidth={2.4} strokeLinejoin="round" />
      </Farg>
    </>
  );
}

/** Punkter med en skattad linje, residualerna och ett konfidensband som vidgas mot kanterna. */
function Regression({ x0, x1, rnd, gauss }: Yta) {
  const yA = BAS - 34 - rnd() * 18;
  const yB = TOPP + 30 + rnd() * 34;
  const fit = (x: number) => yA + ((x - x0) / (x1 - x0)) * (yB - yA);
  const mitt = (x0 + x1) / 2;
  const halv = (x: number) => 8 + ((x - mitt) / (x1 - x0)) ** 2 * 44;
  const ps: Pt[] = Array.from({ length: 24 }, () => {
    const x = x0 + 8 + rnd() * (x1 - x0 - 16);
    return [x, klamp(fit(x) + gauss() * 15, TOPP + 4, BAS - 6)];
  });
  const xs = Array.from({ length: 13 }, (_, i) => x0 + ((x1 - x0) * i) / 12);
  const band: Pt[] = [...xs.map((x): Pt => [x, fit(x) - halv(x)]), ...[...xs].reverse().map((x): Pt => [x, fit(x) + halv(x)])];
  return (
    <>
      <Axel x0={x0} x1={x1} y />
      <path d={ps.map(([x, y]) => `M${t1(x)} ${t1(y)}V${t1(fit(x))}`).join("")} {...STRECK} strokeOpacity={0.2} />
      <Farg>
        <path d={`${linje(band)}Z`} fill="currentColor" fillOpacity={0.12} />
      </Farg>
      <path d={prickar(ps)} {...STRECK} strokeOpacity={0.5} strokeWidth={5.5} strokeLinecap="round" />
      <Farg>
        <path d={linje([[x0, fit(x0)], [x1, fit(x1)]])} {...STRECK} strokeWidth={2.4} strokeLinecap="round" />
      </Farg>
    </>
  );
}

/** Ett snett histogram med den skattade tätheten ovanpå. */
function Histogram({ x0, x1, rnd }: Yta) {
  const bins = 15;
  const bw = (x1 - x0) / bins;
  const m = 0.15 + rnd() * 0.3;
  const s = 0.42 + rnd() * 0.16;
  const U = (x: number) => ((x - x0) / (x1 - x0)) * 3.2 + 0.03;
  const f = (u: number) => Math.exp(-((Math.log(u) - m) ** 2) / (2 * s * s)) / u;
  const xs = Array.from({ length: 41 }, (_, i) => x0 + ((x1 - x0) * i) / 40);
  const max = Math.max(...xs.map((x) => f(U(x))));
  const Y = (x: number, brus = 1) => BAS - (f(U(x)) / max) * 148 * brus;
  const staplar = Array.from({ length: bins }, (_, i) => {
    const v = x0 + i * bw + 1.2;
    const y = klamp(Y(v + bw / 2, 0.84 + rnd() * 0.3), TOPP, BAS - 3);
    return `M${t1(v)} ${BAS}V${t1(y)}H${t1(v + bw - 2.4)}V${BAS}Z`;
  }).join("");
  const kurva = xs.map((x): Pt => [x, Y(x)]);
  return (
    <>
      <path d={staplar} fill="currentColor" fillOpacity={0.13} />
      <Axel x0={x0} x1={x1} />
      <Farg>
        <path d={`${linje(kurva)}L${x1} ${BAS}H${x0}Z`} fill="currentColor" fillOpacity={0.07} />
        <path d={linje(kurva)} {...STRECK} strokeWidth={2.4} strokeLinejoin="round" />
      </Farg>
    </>
  );
}

/** En tidsserie med säsong och trend, och en prognos med ett intervall som vidgas. */
function Tidsserie({ x0, x1, rnd, gauss }: Yta) {
  const obs = 19;
  const prog = 7;
  const dx = (x1 - x0) / (obs + prog - 1);
  const start = BAS - 44 - rnd() * 14;
  const drift = 3 + rnd() * 1.6;
  const fas = rnd() * 6;
  const serie: Pt[] = Array.from({ length: obs }, (_, i) => [x0 + i * dx, klamp(start - drift * i + Math.sin(i * 0.95 + fas) * 11 + gauss() * 4, TOPP, BAS - 6)]);
  const [lx, ly] = serie[obs - 1];
  const fram: Pt[] = Array.from({ length: prog }, (_, h) => [lx + h * dx, ly - drift * h]);
  const band: Pt[] = [...fram.map(([x, y], h): Pt => [x, y - h * 4.6]), ...fram.map(([x, y], h): Pt => [x, y + h * 4.6]).reverse()];
  return (
    <>
      <Axel x0={x0} x1={x1} />
      <path d={`M${t1(lx)} ${BAS}V${TOPP + 6}`} {...STRECK} strokeOpacity={0.25} strokeDasharray="3 4" />
      <Farg>
        <path d={`${linje(band)}Z`} fill="currentColor" fillOpacity={0.13} />
        <path d={linje(fram)} {...STRECK} strokeWidth={2.2} strokeDasharray="5 5" strokeLinecap="round" />
      </Farg>
      <path d={linje(serie)} {...STRECK} strokeOpacity={0.55} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={prickar(serie.slice(0, -1))} {...STRECK} strokeOpacity={0.7} strokeWidth={4.5} strokeLinecap="round" />
      <Farg>
        <path d={prickar([[lx, ly]])} {...STRECK} strokeWidth={8} strokeLinecap="round" />
      </Farg>
    </>
  );
}

/** Antal per tillfälle: observerade staplar och den anpassade Poissonfördelningen som stolpar. */
function Poisson({ x0, x1, rnd }: Yta) {
  const lam = 2.4 + rnd() * 3.2;
  const K = 12;
  const pmf = (k: number) => {
    let p = Math.exp(-lam);
    for (let i = 1; i <= k; i++) p *= lam / i;
    return p;
  };
  const ps = Array.from({ length: K + 1 }, (_, k) => pmf(k));
  const max = Math.max(...ps);
  const steg = (x1 - x0 - 20) / K;
  const X = (k: number) => x0 + 10 + k * steg;
  const Y = (k: number) => BAS - (ps[k] / max) * 148;
  const b = steg * 0.62;
  const staplar = ps.map((_, k) => `M${t1(X(k) - b / 2)} ${BAS}V${t1(klamp(BAS - (BAS - Y(k)) * (0.8 + rnd() * 0.36), TOPP, BAS - 2))}h${t1(b)}V${BAS}Z`).join("");
  return (
    <>
      <path d={staplar} fill="currentColor" fillOpacity={0.12} />
      <Axel x0={x0} x1={x1} />
      <Farg>
        <path d={ps.map((_, k) => `M${t1(X(k))} ${BAS}V${t1(Y(k))}`).join("")} {...STRECK} strokeWidth={1.6} />
        <path d={prickar(ps.map((_, k): Pt => [X(k), Y(k)]))} {...STRECK} strokeWidth={7} strokeLinecap="round" />
      </Farg>
    </>
  );
}

/** Fem lådagram med stigande median. Ett av dem är markerat. */
function Ladagram({ x0, x1, rnd, gauss }: Yta) {
  const n = 5;
  const steg = (x1 - x0) / n;
  const b = Math.min(30, steg * 0.52);
  const vald = Math.floor(rnd() * n);
  const delar = Array.from({ length: n }, (_, i) => {
    const cx = x0 + steg * (i + 0.5);
    const med = klamp(BAS - 64 - i * 15 + gauss() * 8, TOPP + 40, BAS - 40);
    const q3 = med - 11 - rnd() * 13;
    const q1 = med + 11 + rnd() * 13;
    const hog = Math.max(TOPP, q3 - 14 - rnd() * 22);
    const lag = Math.min(BAS - 4, q1 + 14 + rnd() * 22);
    const lada = `M${t1(cx - b / 2)} ${t1(q3)}h${t1(b)}V${t1(q1)}h${t1(-b)}Z`;
    const morrhar = `M${t1(cx)} ${t1(q3)}V${t1(hog)}M${t1(cx - b / 4)} ${t1(hog)}h${t1(b / 2)}M${t1(cx)} ${t1(q1)}V${t1(lag)}M${t1(cx - b / 4)} ${t1(lag)}h${t1(b / 2)}`;
    const median = `M${t1(cx - b / 2)} ${t1(med)}h${t1(b)}`;
    const avvikare: Pt[] = rnd() > 0.55 ? [[cx + (rnd() - 0.5) * 6, Math.max(TOPP - 10, hog - 9 - rnd() * 12)]] : [];
    return { lada, morrhar, median, avvikare };
  });
  const ovriga = delar.filter((_, i) => i !== vald);
  const v = delar[vald];
  return (
    <>
      <Axel x0={x0} x1={x1} />
      <path d={ovriga.map((d) => d.lada).join("")} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.3} />
      <path d={ovriga.map((d) => d.morrhar).join("")} {...STRECK} strokeOpacity={0.4} strokeWidth={1.2} />
      <path d={ovriga.map((d) => d.median).join("")} {...STRECK} strokeOpacity={0.85} strokeWidth={2.2} />
      <path d={prickar(ovriga.flatMap((d) => d.avvikare))} {...STRECK} strokeOpacity={0.5} strokeWidth={4.5} strokeLinecap="round" />
      <Farg>
        <path d={v.lada} fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={1.6} />
        <path d={v.morrhar} {...STRECK} strokeWidth={1.4} />
        <path d={v.median} {...STRECK} strokeWidth={2.6} />
        <path d={prickar(v.avvikare)} {...STRECK} strokeWidth={5} strokeLinecap="round" />
      </Farg>
    </>
  );
}

/** En korrelationsmatris: positiva samband i färgen, negativa i bläcket, starkare ju tydligare. */
function Korrelation({ x0, x1, rnd, gauss, mitten }: Yta & { mitten: boolean }) {
  const n = 7;
  const c = 22;
  const g = 3;
  const sida = n * (c + g) - g;
  const ox = mitten ? (x0 + x1 - sida) / 2 : x0;
  const oy = BAS - sida;
  const laddning = Array.from({ length: n }, () => rnd() * 1.7 - 0.6);
  const banor: Record<string, string> = {};
  let starkast = { r: 0, x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const r = i === j ? 1 : klamp(laddning[i] * laddning[j] * 0.9 + gauss() * 0.12, -0.95, 0.95);
      const x = ox + j * (c + g);
      const y = oy + i * (c + g);
      if (i !== j && Math.abs(r) > Math.abs(starkast.r)) starkast = { r, x, y };
      const niva = klamp(Math.round(Math.abs(r) * 5), 1, 5);
      const nyckel = `${r >= 0 ? "p" : "n"}${niva}`;
      banor[nyckel] = (banor[nyckel] ?? "") + `M${t1(x)} ${t1(y)}h${c}v${c}h-${c}Z`;
    }
  }
  const ruta = (k: string) => {
    const niva = Number(k.slice(1)) / 5;
    return <path key={k} d={banor[k]} fill="currentColor" fillOpacity={Math.round(niva * (k[0] === "p" ? 70 : 36)) / 100} />;
  };
  const nycklar = Object.keys(banor).sort();
  return (
    <>
      {nycklar.filter((k) => k[0] === "n").map(ruta)}
      <Farg>
        {nycklar.filter((k) => k[0] === "p").map(ruta)}
        <path d={`M${t1(starkast.x - 3)} ${t1(starkast.y - 3)}h${c + 6}v${c + 6}h-${c + 6}Z`} {...STRECK} strokeWidth={1.6} />
      </Farg>
    </>
  );
}

/** Tre grupper med sina medelpunkter, som k-medel. En av grupperna är markerad. */
function Kluster({ x0, x1, rnd, gauss }: Yta) {
  const s = 11 + rnd() * 5;
  const vald = Math.floor(rnd() * 3);
  // Höjderna blandas, så att grupperna inte står på rad.
  const hojder = [0.1, 0.5, 0.9].sort(() => rnd() - 0.5);
  const grupper = [0.18, 0.5, 0.82].map((andel, i) => {
    const mitt: Pt = [x0 + (x1 - x0) * (andel + (rnd() - 0.5) * 0.06), TOPP + 30 + (hojder[i] + (rnd() - 0.5) * 0.1) * (BAS - TOPP - 76)];
    const ps = Array.from({ length: 11 }, (): Pt => [klamp(mitt[0] + gauss() * s, x0 + 4, x1 - 4), klamp(mitt[1] + gauss() * s * 0.85, TOPP + 4, BAS - 6)]);
    return { mitt, ps };
  });
  const kors = ([x, y]: Pt) => `M${t1(x - 6)} ${t1(y)}h12M${t1(x)} ${t1(y - 6)}v12`;
  const ovriga = grupper.filter((_, i) => i !== vald);
  const v = grupper[vald];
  return (
    <>
      <Axel x0={x0} x1={x1} y />
      <path d={ovriga.map((gr) => ring(gr.mitt, s * 2)).join("")} {...STRECK} strokeOpacity={0.25} strokeDasharray="3 4" />
      <path d={prickar(ovriga.flatMap((gr) => gr.ps))} {...STRECK} strokeOpacity={0.45} strokeWidth={5.5} strokeLinecap="round" />
      <path d={ovriga.map((gr) => kors(gr.mitt)).join("")} {...STRECK} strokeOpacity={0.8} strokeWidth={2} />
      <Farg>
        <path d={ring(v.mitt, s * 2)} {...STRECK} strokeOpacity={0.7} strokeDasharray="3 4" strokeWidth={1.3} />
        <path d={prickar(v.ps)} {...STRECK} strokeWidth={6} strokeLinecap="round" />
        <path d={kors(v.mitt)} {...STRECK} strokeWidth={2.2} />
      </Farg>
    </>
  );
}

type Motiv = "korrelation" | "regression" | "histogram" | "ladagram" | "poisson" | "kluster" | "tidsserie" | "normal";

/**
 * Motiven i den ordning rubriken prövas mot dem, med orden som väljer dem. Ett ord räknas om rubriken har ett ord som börjar
 * eller slutar med det, eller (från fem bokstäver) innehåller det, så att sammansättningar som höstsittning hittas.
 * Med = framför måste ordet stå ensamt, som STAR, som annars hade träffat start.
 */
const MOTIV: Record<Motiv, { text: string; ord: string[] }> = {
  korrelation: {
    text: "Korrelation · ρ(X, Y)",
    ord: ["data", "=kod", "koda", "programmer", "python", "workshop", "hackathon", "analys", "maskininlärning", "excel", "=sql", "matlab", "=lan", "dator", "spel"],
  },
  regression: {
    text: "Regression · ŷ = β₀ + β₁x",
    ord: ["företag", "=star", "karriär", "jobb", "praktik", "mässa", "lunch", "föreläs", "sponsor", "samarbet", "alumn", "exjobb", "arbetsmarknad", "=lön", "näringsliv"],
  },
  histogram: { text: "Histogram · f(x)", ord: ["kurs", "utvärdering", "enkät", "resultat", "tenta", "betyg", "studie", "utbildning", "program", "plugg", "schema", "läsår"] },
  ladagram: {
    text: "Lådagram · Q₁ Q₂ Q₃",
    ord: [
      ...["=val", "valet", "valber", "nominer", "styrelse", "möte", "beslut", "protokoll", "budget", "ekonomi", "motion", "stadga", "verksamhet", "proposition", "rösta"],
      ...["innebandy", "fotboll", "sport", "match", "turnering", "tävling", "träning", "lopp", "spring"],
    ],
  },
  poisson: { text: "Poisson · P(X = k)", ord: ["sittning", "fest", "gasque", "=pub", "pubkväll", "pubrunda", "sexa", "kalas", "middag", "bankett", "biljett", "anmälan"] },
  kluster: { text: "Kluster · k = 3", ord: ["nollning", "välkommen", "medlem", "engager", "utskott", "grupp", "team", "träff", "introduktion", "mingel", "film", "fika"] },
  tidsserie: { text: "Tidsserie · prognos", ord: ["webb", "sajt", "hemsida", "lanser", "uppdater", "jubileum", "historia", "framtid", "trend"] },
  normal: { text: "Normalfördelning · N(μ, σ²)", ord: ["statistik", "fördelning", "hypotes", "test"] },
};
const ORDNING = Object.keys(MOTIV) as Motiv[];

function traffar(ord: string, nyckel: string) {
  if (nyckel.startsWith("=")) return ord === nyckel.slice(1);
  return ord.startsWith(nyckel) || ord.endsWith(nyckel) || (nyckel.length >= 5 && ord.includes(nyckel));
}

function valjMotiv(titel: string | undefined, rnd: Rnd): Motiv {
  const ord = (titel ?? "").toLowerCase().split(/[^a-z0-9åäöéü]+/).filter(Boolean);
  return ORDNING.find((m) => MOTIV[m].ord.some((n) => ord.some((o) => traffar(o, n)))) ?? ORDNING[Math.floor(rnd() * ORDNING.length)];
}

/** Utskottets färg, om den har någon kulör och inte är röd. Svart, grått och rött ger sajtens röda (--color-red). */
function kulor(accent?: string | null) {
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return undefined;
  const n = parseInt(accent.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 48 || (r > 150 && g < 90 && b < 90)) return undefined;
  return accent;
}

export function CoverArt({
  seed,
  title,
  accent,
  logo,
  className,
  label,
}: {
  seed: string;
  /** Rubriken väljer motivet. Utan den väljs det efter nyckeln. */
  title?: string;
  accent?: string | null;
  logo?: string | null;
  className?: string;
  label?: string;
}) {
  const rnd = mulberry32(hashString(seed));
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;
  const motiv = valjMotiv(title, rnd);
  // Med en logga står diagrammet till vänster och loggan i hörnet nere till höger; utan står diagrammet i mitten.
  const yta: Yta = { x0: 30, x1: logo ? 290 : 370, rnd, gauss };
  const farg = kulor(accent);
  const ritning = {
    korrelation: <Korrelation {...yta} mitten={!logo} />,
    regression: <Regression {...yta} />,
    histogram: <Histogram {...yta} />,
    ladagram: <Ladagram {...yta} />,
    poisson: <Poisson {...yta} />,
    kluster: <Kluster {...yta} />,
    tidsserie: <Tidsserie {...yta} />,
    normal: <Normal {...yta} />,
  }[motiv];

  return (
    <div
      className={cn("cover-art grid-millimeter relative overflow-hidden bg-paper-2 text-ink", className)}
      data-farg={farg ? "" : undefined}
      style={farg ? ({ "--omslag-utskott": farg } as CSSProperties) : undefined}
      aria-hidden={!label}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {/* meet: diagrammet ritas alltid helt och står nere till vänster (eller i mitten). På en bred yta fortsätter papperet åt sidan. */}
      <svg viewBox="0 0 400 250" preserveAspectRatio={logo ? "xMinYMax meet" : "xMidYMax meet"} className="absolute inset-0 h-full w-full">
        {ritning}
      </svg>
      <span className="absolute bottom-2 left-3.5 whitespace-nowrap font-mono text-[0.62rem] leading-none text-stone sm:bottom-2.5 sm:left-4">{MOTIV[motiv].text}</span>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- Inte lazy: på /nyheter är loggan i första kortet ofta det största som syns.
        <img src={logo} alt="" className="absolute -bottom-[11%] -right-[4%] h-[74%] w-auto max-w-[60%] rotate-[-6deg] object-contain object-right-bottom opacity-[0.92]" />
      )}
    </div>
  );
}
