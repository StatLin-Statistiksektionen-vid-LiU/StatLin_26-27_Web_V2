import type { CSSProperties, ReactNode } from "react";

/**
 * Utskottens motiv, ritade runt loggan på 400 × 400 (se motiv.tsx). Linjer utan egen färg får textens, och var(--motiv) är
 * utskottets accentfärg. Loggan täcker cirkeln med radie 120 runt mitten, så allt här håller sig utanför radie 128.
 *
 * Varje del har en klass för hur den kommer in i entrén på utskottets sida (.entre i globals.css) och nar() för när. Utan entré
 * gör klasserna ingenting. Det som ritas (e-rita) behöver pathLength 1.
 */
type Punkt = [x: number, y: number];

const MITT = 200;
const ACCENT = "var(--motiv)";
const av = (x: number) => Math.round(x * 10) / 10;
const xy = ([x, y]: Punkt) => `${av(x)} ${av(y)}`;

/** När delen kommer in i entrén, i sekunder från att sidan öppnas, och hur länge det tar. */
const nar = (d: number, t?: number) => ({ "--d": `${av(d * 100) / 100}s`, ...(t !== undefined && { "--t": `${t}s` }) }) as CSSProperties;

/** Flyttar punkten en sträcka åt en vinkel. Vinklar räknas i grader medurs från klockan tolv. */
function steg([x, y]: Punkt, grader: number, l: number): Punkt {
  const v = ((grader - 90) * Math.PI) / 180;
  return [x + l * Math.cos(v), y + l * Math.sin(v)];
}

/** Punkt på en cirkel runt mitten. */
const pol = (r: number, grader: number) => steg([MITT, MITT], grader, r);

/** Cirkelbåge runt mitten, medurs från en vinkel till en annan. */
const bage = (r: number, fran: number, till: number) => `M${xy(pol(r, fran))}A${r} ${r} 0 ${till - fran > 180 ? 1 : 0} 1 ${xy(pol(r, till))}`;

/** Radiella streck mellan två radier vid de givna vinklarna. */
const streck = (r1: number, r2: number, vinklar: number[]) => vinklar.map((v) => `M${xy(pol(r1, v))}L${xy(pol(r2, v))}`).join("");

/** Rak linje mellan två punkter som stannar en bit före var ände. */
function lank(a: Punkt, b: Punkt, glappA = 0, glappB = 0) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pa = (t: number): Punkt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return `M${xy(pa(glappA / l))}L${xy(pa(1 - glappB / l))}`;
}

/** Mjuk linje längs en rad styrpunkter. */
function mjuk(p: Punkt[]) {
  const mellan = p.slice(1).map((q, i): Punkt => [(p[i][0] + q[0]) / 2, (p[i][1] + q[1]) / 2]);
  return `M${xy(p[0])}L${xy(mellan[0])}Q${xy(p[1])} ${xy(mellan[1])}${mellan
    .slice(2)
    .map((m) => `T${xy(m)}`)
    .join("")}L${xy(p[p.length - 1])}`;
}

/* STIG: fotbollsplanen uppifrån med loggan som boll på mittpunkten, och ett anfall uppritat som på en taktiktavla. */
const planhalva = (d: number) => (
  <>
    <path className="e-rita" pathLength={1} style={nar(d, 0.9)} d="M10 112H50V288H10M10 160H26V240H10M10 182H2V218H10" />
    <path className="e-rita" pathLength={1} style={nar(d + 0.3, 0.6)} d="M50 185.3A19 19 0 0 1 50 214.7M10 45A9 9 0 0 0 19 36M10 355A9 9 0 0 1 19 364" />
    <circle className="e-pop" style={nar(d + 0.7)} cx="38" cy="200" r="1.6" fill="currentColor" stroke="none" />
  </>
);
const kryss = (x: number, y: number, s = 5.5) => `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`;
/** Pilspets i punkten, riktad åt vinkeln. */
const pilspets = (p: Punkt, grader: number) => `M${xy(steg(p, grader + 154, 9))}L${xy(p)}L${xy(steg(p, grader - 154, 9))}`;

const plan = (
  <>
    {/* Planen ritas upp medan bollen studsar in, och anfallet ritas när den ligger still. */}
    <rect className="e-rita" pathLength={1} style={nar(0, 1.1)} x="10" y="36" width="380" height="328" />
    <path className="e-rita" pathLength={1} style={nar(0.5, 0.4)} d="M200 36V65M200 335V364" />
    <circle className="e-rita" pathLength={1} style={nar(0.6, 0.9)} cx="200" cy="200" r="135" />
    {planhalva(0.3)}
    <g transform="matrix(-1 0 0 1 400 0)">{planhalva(0.5)}</g>
    <path className="e-ton" style={nar(2.1, 0.3)} d={kryss(72, 122) + kryss(328, 106) + kryss(320, 300)} strokeWidth={1.75} />
    <g stroke={ACCENT} strokeWidth={1.75}>
      <circle className="e-pop" style={nar(2.1)} cx="88" cy="88" r="6.5" />
      <circle className="e-pop" style={nar(2.2)} cx="311" cy="74" r="6.5" />
      <circle className="e-pop" style={nar(2.3)} cx="70" cy="297" r="6.5" />
      <path className="e-ton" style={nar(2.5, 0.5)} d="M97 81Q200 20 298 67" strokeDasharray="5 5" />
      <path className="e-ton" style={nar(2.9, 0.2)} d={pilspets([298, 67], 116)} />
      <path className="e-rita" pathLength={1} style={nar(2.6, 0.5)} d="M77 305Q104 340 152 346" />
      <path className="e-ton" style={nar(3.05, 0.2)} d={pilspets([152, 346], 97)} />
    </g>
  </>
);

/*
 * eSTIG: tetrisbitar på ett rutnät, staplade från botten och på väg ner uppifrån. Varje bokstav i kartan är en ruta: i, c, p, o och
 * y är fyllda i loggans färger, n är bara konturer och g är skuggan där den fallande biten landar. Stor bokstav är samma färg
 * som liten men en annan bit, så att två grannar i samma färg får en kant emellan sig.
 */
const RUTA = 16;
const KARTA = [
  ".........................",
  "........iii.....pp.......",
  ".........i.....pp........",
  ".........................",
  ".........................",
  "...o.................c...",
  "...o.................c...",
  "...oo................c...",
  ".....................c...",
  ".........................",
  ".........................",
  ".........................",
  ".........................",
  ".........................",
  "......................y..",
  ".c.g.................gyy.",
  ".cNg.................gyi.",
  ".cNgg................gii.",
  ".cNN.................giN.",
  ".pppcc...............ccN.",
  ".opcc...............ccoN.",
  ".oiinnnn..........ppnooN.",
  ".ooiiyy.p..ooN.ccppnnnoy.",
  ".NNNNyypppooNNNcciiiiyyy.",
  ".........................",
];
const BITFARG: Record<string, string> = { i: ACCENT, c: "#2caadf", p: "#8457a6", o: "#f15a25", y: "#f7b042" };
const ruta = (k: number, r: number) => KARTA[r]?.[k] ?? ".";

/** Vad linjen mellan två grannrutor är: kanten på en bit, kanten på en skugga, en skarv inne i biten eller ingenting. */
function linjeslag(a: string, b: string) {
  if (a === b) return a === "." || a === "g" ? "ingen" : "skarv";
  return (a === "g" && b === ".") || (a === "." && b === "g") ? "skugga" : "kant";
}

/** Alla linjer av ett slag mellan två rader i kartan som en enda bana, med raka sträckor hopslagna. */
function rutlinjer(slag: string, fran: number, till: number) {
  let d = "";
  for (const lodrat of [false, true]) {
    // Vågräta linjer följer en radgräns och lodräta en kolumngräns.
    const [i0, i1, j0, j1] = lodrat ? [0, 25, fran, till] : [fran, till, 0, 25];
    for (let i = i0; i <= i1; i++) {
      let start = -1;
      for (let j = j0; j <= j1; j++) {
        const med = j < j1 && linjeslag(lodrat ? ruta(i - 1, j) : ruta(j, i - 1), lodrat ? ruta(i, j) : ruta(j, i)) === slag;
        if (med && start < 0) start = j;
        if (!med && start >= 0) {
          d += lodrat ? `M${i * RUTA} ${start * RUTA}V${j * RUTA}` : `M${start * RUTA} ${i * RUTA}H${j * RUTA}`;
          start = -1;
        }
      }
    }
  }
  return d;
}

/** Radens rutor i varje färg som fyllda kvadrater. */
const radfyllning = (rad: string, r: number) =>
  Object.entries(BITFARG).flatMap(([farg, kulor]) => {
    const d = [...rad].map((tecken, k) => (tecken.toLowerCase() === farg ? `M${k * RUTA} ${r * RUTA}h${RUTA}v${RUTA}h${-RUTA}z` : "")).join("");
    return d ? [<path key={farg} d={d} fill={kulor} fillOpacity={0.88} stroke="none" />] : [];
  });

const rutnat = (fran: number, till: number) => (
  <>
    <path d={rutlinjer("skarv", fran, till)} strokeWidth={1} opacity={0.5} />
    <path d={rutlinjer("kant", fran, till)} />
    <path d={rutlinjer("skugga", fran, till)} strokeDasharray="3 3.4" strokeWidth={1.25} />
  </>
);

// Raderna ovanför den här är bitarna som faller, resten är stapeln.
const FALLER = 10;

const block = (
  <>
    {/* Stapeln läggs rad för rad nerifrån, och sist faller bitarna högst upp in i steg, som i spelet. */}
    {KARTA.map((rad, r) => r >= FALLER && radfyllning(rad, r).length > 0 && (
      <g key={r} className="e-ton" style={nar(0.2 + (KARTA.length - r) * 0.07, 0.01)}>
        {radfyllning(rad, r)}
      </g>
    ))}
    <g className="e-ton" style={nar(0.9, 0.5)}>
      {rutnat(FALLER, KARTA.length)}
    </g>
    <g className="e-fall" style={nar(1.3)}>
      {KARTA.slice(0, FALLER).map((rad, r) => radfyllning(rad, r))}
      {rutnat(0, FALLER)}
    </g>
  </>
);

/* SCB: vimplar på linor som är uppnålade över och under loggan, och lite konfetti. */
const GUL = "#f2e22b";

/** En lina som hänger mellan a och b (k drar ner den), och vimplarna längs den. Linan spänns upp vid d, och vimplarna följer en i taget. */
function girlang(a: Punkt, k: Punkt, b: Punkt, antal: number, d: number, forsta = 0) {
  const pa = (t: number): Punkt => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * k[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * k[1] + t * t * b[1]];
  return (
    <>
      <path className="e-rita" pathLength={1} style={nar(d, 0.8)} d={`M${xy(a)}Q${xy(k)} ${xy(b)}`} />
      {[a, b].map(([x, y], i) => (
        <circle key={`nal${i}`} className="e-pop" style={nar(d + i * 0.8)} cx={x} cy={y} r="2.4" fill="currentColor" stroke="none" />
      ))}
      {Array.from({ length: antal }, (_, i) => {
        const [p, q] = [pa((i + 0.13) / antal), pa((i + 0.87) / antal)];
        const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
        const bredd = Math.hypot(dx, dy);
        // Spetsen pekar vinkelrätt ut från linan men dras lite nedåt av sin egen tyngd.
        const tecken = dx >= 0 ? 1 : -1;
        const [nx, ny] = [(-dy / bredd) * tecken * 0.65, (dx / bredd) * tecken * 0.65 + 0.35];
        const langd = (bredd * 1.2) / Math.hypot(nx, ny);
        const form = `M${xy(p)}L${xy(q)}L${xy([(p[0] + q[0]) / 2 + nx * langd, (p[1] + q[1]) / 2 + ny * langd])}Z`;
        const slag = (i + forsta) % 3;
        const in_ = { className: "e-pop", style: nar(d + 0.2 + (i * 0.8) / antal, 0.5) };
        if (slag === 0) return <path key={i} {...in_} d={form} fill={ACCENT} stroke={ACCENT} strokeWidth={1} />;
        return <path key={i} {...in_} d={form} strokeWidth={1.25} fill={slag === 1 ? GUL : "none"} />;
      })}
    </>
  );
}

const vimplar = (
  <>
    {girlang([116, 8], [48, 128], [8, 200], 7, 0.1)}
    {girlang([300, 8], [356, 112], [392, 178], 6, 0.3, 1)}
    {girlang([8, 264], [200, 446], [392, 252], 13, 0.5, 2)}
    {/* Konfettin kommer när flaggan är uppe. */}
    <path className="e-ton" style={nar(1.7, 0.3)} d="M168 34l7 4M232 22l5-6M22 232l6 5M384 208l-7 4M40 352l7-3M356 356l5 6" stroke={ACCENT} strokeWidth={2.25} />
    <path className="e-ton" style={nar(1.85, 0.3)} d="M206 44l6 3M258 40l-4 6M28 26l6 3M372 20l-6 4M72 384l5-5M330 384l-6-4" strokeWidth={2.25} />
    {[
      [188, 16],
      [246, 54],
      [14, 222],
      [386, 228],
      [18, 372],
      [380, 340],
    ].map(([x, y], i) => (
      <circle key={i} className="e-pop" style={nar(1.75 + i * 0.06)} cx={x} cy={y} r="2.6" fill={i % 2 ? GUL : ACCENT} stroke={i % 2 ? "currentColor" : "none"} strokeWidth={1} />
    ))}
  </>
);

/* StatPub: kolsyran stiger i pärlband runt loggan och växer på vägen upp, och skummet ligger överst. */
// x, y, radie och om bubblan är fylld
const BUBBLOR: [number, number, number, boolean?][] = [
  [40, 372, 2],
  [34, 350, 2.5, true],
  [42, 326, 3.5],
  [32, 298, 4.5],
  [41, 268, 5.5, true],
  [30, 236, 6.5],
  [40, 200, 8],
  [28, 162, 9.5, true],
  [40, 122, 11],
  [28, 92, 6],
  [92, 376, 2],
  [84, 356, 3, true],
  [76, 332, 4],
  [68, 304, 5],
  [74, 104, 5, true],
  [98, 88, 3.5],
  [150, 376, 2.5],
  [166, 358, 3.5, true],
  [230, 372, 3],
  [216, 354, 2],
  [264, 364, 4, true],
  [308, 376, 2.5],
  [318, 352, 3.5],
  [328, 324, 4.5, true],
  [336, 294, 5.5],
  [362, 370, 2],
  [368, 346, 3, true],
  [358, 318, 4],
  [370, 288, 5],
  [360, 254, 6.5, true],
  [371, 218, 5.5],
  [360, 184, 8],
  [372, 146, 9.5, true],
  [360, 108, 7],
  [372, 86, 4.5],
  [326, 104, 5.5],
  [302, 88, 3.5, true],
];

const SKUMKANT = "M22 70A17 17 0 0 1 40 44A23 23 0 0 1 80 38A21 21 0 0 1 116 44A27 27 0 0 1 162 36A23 23 0 0 1 202 42A24 24 0 0 1 244 36A22 22 0 0 1 282 44A24 24 0 0 1 324 38A21 21 0 0 1 360 44A17 17 0 0 1 378 70";

const bubblor = (
  <>
    {/* Kolsyran stiger nerifrån medan ölen fylls på, och skummet lägger sig överst sist. */}
    <path className="e-ton" style={nar(1.9, 0.7)} d={`${SKUMKANT}Q338 76 290 68T200 67T110 68T22 70Z`} fill="currentColor" fillOpacity={0.07} stroke="none" />
    <path className="e-rita" pathLength={1} style={nar(1.4, 1)} d={SKUMKANT} />
    <path className="e-rita" pathLength={1} style={nar(1.3, 0.9)} d="M22 70Q62 62 110 68T200 67T290 68T378 70" stroke={ACCENT} strokeWidth={1.75} />
    {[
      [58, 56, 3.5],
      [128, 54, 2.5],
      [182, 56, 4],
      [262, 55, 3],
      [338, 57, 3.5],
    ].map(([x, y, r], i) => (
      <circle key={i} className="e-pop" style={nar(2 + i * 0.08)} cx={x} cy={y} r={r} strokeWidth={1.25} />
    ))}
    <g stroke={ACCENT}>
      {BUBBLOR.flatMap(([x, y, r, fylld], i) => [
        <circle key={i} className="e-pop" style={nar(0.3 + (372 - y) / 250, 0.5)} cx={x} cy={y} r={r} fill={fylld ? ACCENT : "none"} fillOpacity={0.3} />,
        // De större bubblorna får en glansbåge uppe till vänster.
        r >= 5 && <path key={`glans${i}`} className="e-ton" style={nar(0.6 + (372 - y) / 250, 0.3)} d={`M${av(x - r * 0.55)} ${av(y - r * 0.1)}A${av(r * 0.56)} ${av(r * 0.56)} 0 0 1 ${av(x - r * 0.1)} ${av(y - r * 0.55)}`} strokeWidth={1.25} />,
      ])}
    </g>
  </>
);

/* UBU: två grenar växer upp runt loggan, kala som trädet i den men med årets första blad. */
type Kvist = [vinkel: number, langd: number, blad?: "fyllt" | "tomt", gaffel?: boolean];

/** Ett blad från en punkt åt en vinkel. Det slår ut från sitt fäste vid d. */
function blad([x, y]: Punkt, grader: number, fyllt: boolean, key: string, d: number, l = 19) {
  const halva = (s: number) => `C${av(l * 0.28)} ${av(s * l * 0.34)} ${av(l * 0.7)} ${av(s * l * 0.3)} ${l} 0`;
  return (
    // Platsen står på gruppen, så att bladet kan växa från sitt eget fäste.
    <g key={key} transform={`translate(${av(x)} ${av(y)}) rotate(${av(grader - 90)})`}>
      <path
        className="e-gro"
        style={nar(d)}
        d={`M0 0${halva(-1)}M0 0${halva(1)}${fyllt ? "" : `M0 0H${av(l * 0.62)}`}`}
        stroke={ACCENT}
        strokeWidth={1.25}
        fill={fyllt ? ACCENT : "none"}
        fillOpacity={0.85}
      />
    </g>
  );
}

/** En gren som följer loggans rand från en vinkel till en annan, med kvistar utåt. Den växer från roten vid d, och bladen slår ut efter hand. */
function gren(start: number, slut: number, kvistar: Kvist[], d: number) {
  const hall = slut > start ? 1 : -1;
  // Stammen börjar längre ut, så att de två grenarna korsas under loggan.
  const stam = (a: number) => pol(148 + 18 * Math.max(0, 1 - Math.abs(a - start) / 18) + 4 * Math.sin((a - start) / 17), a);
  const antal = Math.round(Math.abs(slut - start) / 8);
  const ryggrad = Array.from({ length: antal + 1 }, (_, i) => stam(start + ((slut - start) * i) / antal));
  let ris = "";
  const lov: ReactNode[] = [blad(stam(slut), slut + hall * 62, true, "topp", d + 1.9)];
  const utslag = (i: number) => d + 0.6 + (i * 1.2) / kvistar.length;
  kvistar.forEach(([a, l, bladslag, gaffel], i) => {
    const rot = stam(a);
    const boj = steg(rot, a + hall * 72, l * 0.5);
    const spets = steg(rot, a + hall * 50, l);
    ris += `M${xy(rot)}Q${xy(boj)} ${xy(spets)}`;
    if (gaffel) {
      const mitt: Punkt = [rot[0] / 4 + boj[0] / 2 + spets[0] / 4, rot[1] / 4 + boj[1] / 2 + spets[1] / 4];
      const sida = a + hall * (i % 2 ? 96 : bladslag ? -18 : 14);
      ris += `M${xy(mitt)}L${xy(steg(mitt, sida, l * 0.42))}`;
      if (bladslag) lov.push(blad(steg(mitt, sida, l * 0.42), sida, bladslag !== "fyllt", `g${i}`, utslag(i) + 0.15, 15));
    }
    if (bladslag) lov.push(blad(spets, a + hall * 30, bladslag === "fyllt", `${i}`, utslag(i)));
  });
  return (
    <>
      <path className="e-rita" pathLength={1} style={nar(d, 1.6)} d={mjuk(ryggrad)} strokeWidth={1.75} />
      <path className="e-rita" pathLength={1} style={nar(d + 0.3, 1.5)} d={ris} strokeWidth={1.25} />
      {lov}
    </>
  );
}

const trad = (
  <>
    {gren(172, 342, [
      [190, 30],
      [204, 40, undefined, true],
      [219, 50, "tomt", true],
      [234, 38],
      [248, 42, "fyllt", true],
      [262, 36, "tomt"],
      [276, 42, "fyllt", true],
      [290, 48, "fyllt"],
      [304, 44, "tomt", true],
      [317, 36, "fyllt"],
      [329, 26, "fyllt"],
    ], 0)}
    {gren(188, 16, [
      [172, 28],
      [158, 42, "tomt", true],
      [143, 48, undefined, true],
      [128, 40, "fyllt"],
      [113, 44, undefined, true],
      [99, 36, "fyllt"],
      [85, 42, "tomt", true],
      [71, 48, "fyllt", true],
      [57, 42, "fyllt"],
      [44, 36, "tomt"],
      [32, 26, "fyllt"],
    ], 0.12)}
  </>
);

/* SASU: ett nätverk. Sex nav runt loggan, som skivans sex hål, binder ihop studenter (prickar) med företag (rutor). */
const NAV = [0, 60, 120, 180, 240, 300].map((v) => pol(152, v));
const NAVRADIE = 7.5;
const NAVKANTER = NAV.map((p, i) => lank(p, NAV[(i + 1) % 6], NAVRADIE, NAVRADIE));
type Nod = [x: number, y: number, nav: number[]];
const STUDENTER: Nod[] = [
  [110, 32, [5, 0]],
  [24, 84, [5]],
  [20, 166, [5]],
  [28, 236, [4]],
  [20, 312, [4]],
  [108, 370, [4, 3]],
];
const FORETAG: Nod[] = [
  [292, 26, [0, 1]],
  [376, 86, [1]],
  [374, 168, [1]],
  [370, 236, [2]],
  [378, 314, [2]],
  [294, 374, [3, 2]],
];
const sprot = ([x, y, nav]: Nod) => nav.map((n) => lank([x, y], NAV[n], 5, NAVRADIE)).join("");
const mellan = (a: Nod, b: Nod) => lank([a[0], a[1]], [b[0], b[1]], 5, 5);
// Den röda tråden: en student, tre nav och ett företag.
const [ROD_STUDENT, ROD_FORETAG] = [1, 1];

const skiva = (
  <>
    {/* Prickarna kommer först, sedan dras länkarna mellan dem och sist den röda tråden. */}
    <path className="e-rita" pathLength={1} style={nar(0.75, 0.7)} d={NAVKANTER.slice(1, 5).join("")} />
    <path
      className="e-rita"
      pathLength={1}
      style={nar(0.25, 1)}
      d={
        STUDENTER.filter((_, i) => i !== ROD_STUDENT).map(sprot).join("") +
        FORETAG.filter((_, i) => i !== ROD_FORETAG).map(sprot).join("") +
        mellan(STUDENTER[2], STUDENTER[3]) +
        mellan(STUDENTER[4], STUDENTER[5]) +
        mellan(FORETAG[0], FORETAG[1]) +
        mellan(FORETAG[2], FORETAG[3])
      }
      strokeWidth={1.25}
    />
    <path className="e-rita" pathLength={1} style={nar(1, 0.9)} d={sprot(STUDENTER[ROD_STUDENT]) + NAVKANTER[5] + NAVKANTER[0] + sprot(FORETAG[ROD_FORETAG])} stroke={ACCENT} strokeWidth={1.75} />
    {NAV.map(([x, y], i) => (
      <circle key={i} className="e-pop" style={nar(0.5 + i * 0.06)} cx={av(x)} cy={av(y)} r={NAVRADIE} stroke={i === 5 || i < 2 ? ACCENT : undefined} strokeWidth={1.75} />
    ))}
    {STUDENTER.map(([x, y], i) => (
      <circle key={i} className="e-pop" style={nar(i * 0.08)} cx={x} cy={y} r="4.5" fill={i === ROD_STUDENT ? ACCENT : "currentColor"} stroke="none" />
    ))}
    {FORETAG.map(([x, y], i) => (
      <rect key={i} className="e-pop" style={nar(0.1 + i * 0.08)} x={x - 4.5} y={y - 4.5} width="9" height="9" rx="1" fill={i === ROD_FORETAG ? ACCENT : "currentColor"} stroke="none" />
    ))}
  </>
);

/*
 * SASU:s scen: navet kommer först, mitt på den tomma skivan. Sedan skickar det ut de sju hålen, ett i taget medurs, och ekrarnas
 * streck löper ut efter dem: nätverket byggs från mitten. Hålens plats och storlek är mätta i loggan, så när alla är framme tonas
 * loggans egen bild in under dem utan att något flyttar sig.
 */
const SKIVMITT: Punkt = [199.9, 201];
// Medurs från klockan elva.
const HAL: Punkt[] = [
  [179.9, 137.8],
  [236.3, 144.8],
  [265.7, 197.2],
  [243.9, 249.7],
  [189.4, 265.9],
  [142.4, 233.3],
  [138.1, 176.5],
];
const HALRADIE = 17.2;

const skivscen = (
  <>
    {HAL.map((p, i) => (
      <path key={i} className="e-eker" style={nar(0.8 + i * 0.07, 0.7)} d={lank(SKIVMITT, p, HALRADIE, HALRADIE)} stroke="#000" strokeWidth={1} fill="none" />
    ))}
    <g fill="#000" stroke="none">
      {HAL.map(([x, y], i) => (
        <circle
          key={i}
          className="e-flyg"
          style={{ ...nar(0.7 + i * 0.07, 0.75), "--fx": `${av(SKIVMITT[0] - x)}px`, "--fy": `${av(SKIVMITT[1] - y)}px`, "--fs": 0.4 } as CSSProperties}
          cx={x}
          cy={y}
          r={HALRADIE}
        />
      ))}
      <circle className="e-pop" style={nar(0.45)} cx={SKIVMITT[0]} cy={SKIVMITT[1]} r={HALRADIE} />
    </g>
  </>
);

/* AMO: en urtavla runt loggan. Den akademiska kvarten, pausen, är utmärkt som ett mått på en ritning. */
const MINUTER = Array.from({ length: 60 }, (_, i) => i * 6);

const urtavla = (
  <>
    {/* Strecken sätts ut medurs från tolv, i takt med att loggans urtavla sveps fram, och sist mäts kvarten upp. */}
    <path className="e-ton" style={nar(1.7, 0.6)} d={`${bage(131, 0, 90)}L${xy(pol(158, 90))}A158 158 0 0 0 ${xy(pol(158, 0))}Z`} fill={ACCENT} fillOpacity={0.1} stroke="none" />
    <circle className="e-rita" pathLength={1} style={nar(0.1, 1.3)} cx="200" cy="200" r="158" transform="rotate(-90 200 200)" />
    <path className="e-rita" pathLength={1} style={nar(0.6, 1)} d={streck(138, 145, MINUTER.filter((v) => v % 30 !== 0 && v > 90))} strokeWidth={1.25} />
    <path className="e-rita" pathLength={1} style={nar(0.3, 0.35)} d={streck(138, 145, MINUTER.filter((v) => v % 30 !== 0 && v < 90))} stroke={ACCENT} strokeWidth={1.25} />
    <path className="e-rita" pathLength={1} style={nar(0.3, 1.3)} d={streck(138, 151, MINUTER.filter((v) => v % 30 === 0))} stroke={ACCENT} strokeWidth={2.25} />
    <path className="e-rita" pathLength={1} style={nar(1.8, 0.7)} d={bage(170, 0, 90) + streck(164, 176, [0, 90])} stroke={ACCENT} strokeWidth={2} />
    {/* Sekundmarkören går runt urtavlan, ett steg i sekunden, när entrén är klar. */}
    <circle className="e-tick" cx="200" cy="42" r="3" fill={ACCENT} stroke="none" />
  </>
);

export const MOTIV_UTSKOTT = {
  trad,
  skiva,
  vimplar,
  bubblor,
  plan,
  block,
  urtavla,
} satisfies Record<string, ReactNode>;

/** Det som bara finns under entrén och ritas ovanpå loggans lager. */
export const SCEN_UTSKOTT = { skiva: skivscen } satisfies Record<string, ReactNode>;
