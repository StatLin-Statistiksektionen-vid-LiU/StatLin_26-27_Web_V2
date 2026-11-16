import type { ReactNode } from "react";

/**
 * Styrelseposternas motiv, ritade runt StatLins logga på 400 × 400 (se motiv.tsx). Linjer utan egen färg får textens, och
 * var(--motiv) är postens färg. normal är för den som inte har någon av posterna. Loggan täcker radien 126 kring mitten, så
 * allt ritas utanför den, och det viktiga till vänster och höger om loggan, eftersom portalens kort skär bort topp och botten.
 */

const M = "var(--motiv)";
const avr = (n: number) => Math.round(n * 10) / 10;
/** Punkten på avståndet r från (cx, cy), som annars är mitten, g grader medurs från klockan tre. */
const pol = (r: number, g: number, cx = 200, cy = 200) => [avr(cx + r * Math.cos((g * Math.PI) / 180)), avr(cy + r * Math.sin((g * Math.PI) / 180))] as const;
/** Båge kring mitten med radien r, från vinkeln a till b (medurs om b > a). */
const bage = (r: number, a: number, b: number) => {
  const [x1, y1] = pol(r, a);
  const [x2, y2] = pol(r, b);
  return `M${x1} ${y1}A${r} ${r} 0 ${Math.abs(b - a) > 180 ? 1 : 0} ${b > a ? 1 : 0} ${x2} ${y2}`;
};
/** Liten deterministisk slump, så att ritningen blir likadan varje gång. */
const slump = (fro: number) => {
  let s = fro;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/* Ordförande: klubban slår mot loggan, som blir klubbans kloss. smallar är slagets streck kring träffpunkten (34, 0). */
const smallar = [-1, 1].flatMap((s) =>
  [50, 71, 92].map((v) => {
    const [ux, uy] = [-Math.cos((v * Math.PI) / 180), s * Math.sin((v * Math.PI) / 180)];
    return `M${avr(34 + 24 * ux)} ${avr(24 * uy)}L${avr(34 + 36 * ux)} ${avr(36 * uy)}`;
  }),
);
const [kx, ky] = pol(162, 205);
const klubba = (
  <>
    {/* Huvudet ligger kring origo och slår åt +x, mot loggans kant, och skaftet går åt +y. */}
    <g transform={`translate(${kx} ${ky}) rotate(25)`}>
      <rect x="-17" y="-17" width="34" height="34" fill={M} fillOpacity="0.16" stroke="none" />
      <rect x="-27" y="-17" width="54" height="34" rx="4.5" />
      <rect x="-34" y="-14" width="7" height="28" rx="2" />
      <rect x="27" y="-14" width="7" height="28" rx="2" />
      <path d="M-17 -17V17M17 -17V17" stroke={M} />
      <rect x="-6.5" y="17" width="13" height="7" rx="1.5" />
      <path d="M-4 24L-3 88M4 24L3 88" />
      <ellipse cx="0" cy="94" rx="6" ry="7" />
      <path d={smallar.join("")} stroke={M} strokeWidth="1.75" />
    </g>
    {/* Loggan darrar av slaget. */}
    <path d={bage(136, -15, 15) + bage(145, -9, 9)} />
  </>
);

/* Sekreterare: protokollets rader flyter runt loggan, med bockade rutor och en penna som skriver sista raden. */
const RADER = Array.from({ length: 10 }, (_, i) => 100 + i * 20);
/** Raderna som börjar med en ruta. De tre första är bockade. */
const RUTOR = [0, 3, 5, 8];
const SIST = RADER.length - 1;
const kant = (y: number) => Math.sqrt(Math.max(0, 134 ** 2 - (y - 200) ** 2));
/** En textrad som streck av olika längd, som ord, från x0 till x1. */
const ordrad = (x0: number, x1: number, y: number, rnd: () => number) => {
  let d = "";
  for (let x = x0; x1 - x > 5; x += 5) {
    const slut = Math.min(x1, x + 8 + rnd() * 26);
    d += `M${avr(x)} ${y}H${avr(slut)}`;
    x = slut;
  }
  return d;
};
const protokollOrd = (() => {
  const rnd = slump(11);
  return RADER.map((y, i) => ({
    vanster: ordrad(RUTOR.includes(i) ? 36 : 42, 200 - kant(y) - 2 - rnd() * 6, y, rnd),
    hoger: ordrad(200 + kant(y) + 4, i === SIST ? 354 : 388 - rnd() * 36, y, rnd),
  }));
})();
const protokoll = (
  <>
    <path d="M28 88V312" stroke={M} strokeOpacity="0.6" strokeWidth="1" />
    <path d={protokollOrd.map((r) => r.vanster).join("") + protokollOrd.slice(0, -1).map((r) => r.hoger).join("")} />
    <path d={protokollOrd[SIST].hoger} stroke={M} strokeWidth="1.75" />
    {RUTOR.map((i) => (
      <rect key={i} x="9" y={RADER[i] - 6} width="12" height="12" rx="1.5" />
    ))}
    <path d={RUTOR.slice(0, 3).map((i) => `M11 ${RADER[i]}l4 4.5l9 -12`).join("")} stroke={M} strokeWidth="2" />
    {/* Pennspetsen, med spetsen i origo och skaftet uppåt höger. */}
    <g transform={`translate(357 ${RADER[SIST]}) rotate(30)`}>
      <path d="M0 0L-9 -20Q-10 -27 -7 -33H7Q10 -27 9 -20Z" fill={M} fillOpacity="0.14" />
      <path d="M0 0V-15" />
      <circle cx="0" cy="-18" r="2.2" />
      <rect x="-8" y="-58" width="16" height="25" rx="2" />
    </g>
  </>
);

/* Informationsansvarig: loggan är megafonens tratt, och vågorna går ut på andra sidan. */
const vagor = (
  <>
    {/* Tratten vidgar sig mot loggans kant. Bakom den sitter megafonens kropp, munstycke och handtag. */}
    <path d="M48 186Q96 180 120 100M48 214Q96 220 120 300" />
    <rect x="22" y="182" width="26" height="36" rx="4" />
    <rect x="12" y="190" width="10" height="20" rx="2.5" />
    <path d="M32 218L28 254Q27.5 260 33 260H39Q44 260 44.5 254L46 218M48 230Q55 234 51 242" />
    {[140, 158, 176].map((r, i) => (
      <path key={r} d={bage(r, -18 - 7 * i, 18 + 7 * i)} stroke={i === 1 ? M : undefined} strokeWidth={i === 1 ? 2 : 1.5} />
    ))}
  </>
);

/* Kassör: myntstaplar som stiger som ett stapeldiagram, och mynt i omlopp. */
/** En stapel med n mynt sedda snett ovanifrån, som står på bas. */
const stapel = (cx: number, n: number, bas = 282, rx = 14, ry = 4.5, t = 7) => {
  const topp = bas - n * t;
  const sommar = Array.from({ length: n - 1 }, (_, k) => `M${cx - rx} ${bas - (k + 1) * t}a${rx} ${ry} 0 0 0 ${2 * rx} 0`).join("");
  return (
    <g key={cx}>
      <path d={`M${cx - rx} ${topp}V${bas}a${rx} ${ry} 0 0 0 ${2 * rx} 0V${topp}`} fill={M} fillOpacity="0.12" />
      <path d={sommar} />
      <ellipse cx={cx} cy={topp} rx={rx} ry={ry} fill={M} fillOpacity="0.3" stroke={M} />
    </g>
  );
};
/** Ett mynt i omloppsbanan vid vinkeln g, rakt framifrån eller på kant med lutningen. */
const omlopp = (g: number, lutning?: number) => {
  const [x, y] = pol(166, g);
  return lutning === undefined ? (
    <g key={g}>
      <circle cx={x} cy={y} r="9" fill={M} fillOpacity="0.25" stroke={M} />
      <circle cx={x} cy={y} r="6" />
    </g>
  ) : (
    <ellipse key={g} cx={x} cy={y} rx="9" ry="2.6" transform={`rotate(${lutning} ${x} ${y})`} fill={M} fillOpacity="0.25" stroke={M} />
  );
};
const mynt = (
  <>
    <path d="M6 282H90M312 282H394" />
    {stapel(24, 4)}
    {stapel(58, 6)}
    {stapel(340, 8)}
    {stapel(370, 11)}
    <path d={bage(166, 188, 352)} strokeDasharray="0.1 6" />
    {omlopp(196, -40)}
    {omlopp(218)}
    {omlopp(270)}
    {omlopp(322)}
    {omlopp(344, 50)}
  </>
);

/* Grafiskt ansvarig: en bézierkurva runt loggan med ankarpunkter och handtag, skärmärken och färgrutor. */
const ankare = (x: number, y: number, vald = false) => (
  <rect key={`${x}${y}`} x={x - 3.5} y={y - 3.5} width="7" height="7" fill={vald ? M : "none"} stroke={vald ? M : undefined} />
);
const handtag = (ax: number, ay: number, hx: number, hy: number) => (
  <g key={`${hx}${hy}`}>
    <path d={`M${ax} ${ay}L${hx} ${hy}`} strokeWidth="1" />
    <circle cx={hx} cy={hy} r="2.75" fill={M} stroke="none" />
  </g>
);
// Skärmärken kring ett brett format med loggan i mitten, så att de syns i portalens korta kort.
const skarmarken = [
  [24, 100, -1, -1],
  [376, 100, 1, -1],
  [24, 300, -1, 1],
  [376, 300, 1, 1],
]
  .map(([x, y, sx, sy]) => `M${x + sx * 4} ${y}h${sx * 14}M${x} ${y + sy * 4}v${sy * 14}`)
  .join("");
const kurva = (
  <>
    <path d="M42 288C42 262 52 248 52 196C52 144 100 70 176 58C252 46 346 104 352 150" stroke={M} strokeWidth="2" />
    {handtag(52, 196, 52, 248)}
    {handtag(52, 196, 52, 144)}
    {handtag(352, 150, 346, 104)}
    {handtag(352, 150, 358, 196)}
    {ankare(42, 288)}
    {ankare(52, 196, true)}
    {ankare(176, 58)}
    {ankare(352, 150, true)}
    <path d={skarmarken} strokeWidth="1" />
    {[1, 0.55, 0.25, 0].map((o, i) => (
      <rect key={o} x={300 + i * 16} y="286" width="11" height="11" fill={o ? M : "none"} fillOpacity={o} stroke={o ? "none" : undefined} />
    ))}
    <path d="M348 297l11 -11" stroke={M} strokeWidth="1" />
    {/* Pennverktyget, med spetsen i handtagets ände. */}
    <g transform="translate(358 196) rotate(40)">
      <path d="M0 0L-8 -18Q-9 -24 -6 -30H6Q9 -24 8 -18Z" />
      <path d="M0 0V-13" />
      <circle cx="0" cy="-16" r="2" />
      <rect x="-6" y="-36" width="12" height="5" rx="1" />
    </g>
  </>
);

/* Masteransvarig: studentmössan på sned vid loggans kant, en lagerkvist och ett diplom. */
/** Ett spetsigt blad från (x, y) åt vinkeln v, l långt och b brett. */
const blad = (x: number, y: number, v: number, l = 15, b = 6) => {
  const [mx, my] = pol(l / 2, v, x, y);
  const [ax, ay] = pol(b, v - 90, mx, my);
  const [bx, by] = pol(b, v + 90, mx, my);
  const [tx, ty] = pol(l, v, x, y);
  return `M${x} ${y}Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} ${x} ${y}`;
};
const LAGER = [132, 140, 148, 156, 164, 172];
const lagerblad = LAGER.flatMap((g) => {
  const [x, y] = pol(152, g);
  return [blad(x, y, g + 55), blad(x, y, g + 125, 13)];
});
const hatt = (
  <>
    {/* Mössan med tofsen, som hänger från knappen över kanten. */}
    <g transform="translate(74 116) rotate(-16) scale(1.1)">
      <path d="M-22 6L-21 26Q0 34 21 26L22 6" />
      <path d="M-44 0L0 -15L44 0L0 15Z" fill={M} fillOpacity="0.18" />
      <path d="M-44 0v3L0 18L44 3v-3M0 15v3" />
      <path d="M0 0L-36 4V38" stroke={M} />
      <path d="M-39 38h6l2 14h-10Z" fill={M} stroke={M} />
      <circle cx="0" cy="0" r="2.5" fill={M} stroke="none" />
    </g>
    <path d={bage(152, 126, 176)} />
    <path d={lagerblad.filter((_, i) => i % 3).join("")} />
    <path d={lagerblad.filter((_, i) => i % 3 === 0).join("") + blad(...pol(152, 176), 266, 16)} fill={M} fillOpacity="0.3" />
    {/* Diplomet, hoprullat med ett band och snören. */}
    <g transform="translate(342 262) rotate(-55)">
      <rect x="-46" y="-8" width="92" height="16" rx="2" />
      <ellipse cx="46" cy="0" rx="3.5" ry="8" />
      <path d="M46 -3.5a1.6 3.5 0 1 0 0.1 0" />
      <rect x="-4" y="-8.5" width="8" height="17" fill={M} fillOpacity="0.55" stroke="none" />
    </g>
    <path d="M343 265l2 22l3.5 -3l3 2.5l-1 -20" stroke={M} />
  </>
);

/* Normal: normalfördelningen bakom loggan, med skuggade svansar bortom två standardavvikelser. */
/** Kurvans höjd vid x: medelvärdet 200, baslinjen 300 och toppen strax ovanför loggan. */
const SIGMA = 80;
const tathet = (x: number) => avr(300 - 244 * Math.exp(-(((x - 200) / SIGMA) ** 2) / 2));
const klocka = (a: number, b: number) => Array.from({ length: (b - a) / 4 + 1 }, (_, i) => `${i ? "L" : "M"}${a + i * 4} ${tathet(a + i * 4)}`).join("");
const normal = (
  <>
    <path d={`${klocka(8, 40)}V300H8Z`} fill={M} fillOpacity="0.22" stroke="none" />
    <path d={`${klocka(360, 392)}V300H360Z`} fill={M} fillOpacity="0.22" stroke="none" />
    <path d={klocka(8, 392)} strokeWidth="1.75" />
    <path d="M8 300H392" />
    <path d={[120, 280, 40, 360].map((x) => `M${x} 300v6`).join("")} />
    <path d={`M40 300V${tathet(40)}M360 300V${tathet(360)}`} stroke={M} strokeDasharray="3 4" />
  </>
);

export const MOTIV_POSTER = {
  klubba,
  protokoll,
  vagor,
  mynt,
  kurva,
  hatt,
  normal,
} satisfies Record<string, ReactNode>;
