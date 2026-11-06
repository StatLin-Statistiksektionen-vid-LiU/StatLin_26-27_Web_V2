import { hashString, mulberry32, cn } from "@/lib/utils";

/** Rutnätet som en enda bana i stället för 18 linjer. Omslaget står i både HTML och sidans RSC-data, ibland nio gånger på en sida. */
const GRID =
  Array.from({ length: 11 }, (_, i) => `M${i * 40} 0V250`).join("") + Array.from({ length: 7 }, (_, i) => `M0 ${i * 40}H400`).join("");

/** En decimal räcker på en yta som är 400 enheter bred, och halverar längden på varje koordinat. */
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Generativt omslag för evenemang och nyheter som saknar bild.
 * Deterministiskt utifrån en nyckel (slug) – samma evenemang får alltid samma grafik.
 */
export function CoverArt({
  seed,
  accent = "#ff0707",
  logo,
  className,
  label,
}: {
  seed: string;
  accent?: string;
  logo?: string | null;
  className?: string;
  label?: string;
}) {
  const rnd = mulberry32(hashString(seed));
  const variant = Math.floor(rnd() * 3);
  const slope = 0.25 + rnd() * 0.45;
  const points = Array.from({ length: 46 }, () => {
    const x = rnd() * 400;
    const noise = (rnd() + rnd() + rnd() - 1.5) * 70;
    return { x, y: 250 - (x * slope + 40 + noise), r: 1.5 + rnd() * 3.5, red: rnd() > 0.85 };
  });
  let line = "";
  let v = 0;
  for (let x = -10; x <= 410; x += 10) {
    v += (rnd() - 0.45) * 14;
    v *= 0.9;
    line += `${x === -10 ? "M" : "L"}${x},${(250 - (x * slope + 50) + v).toFixed(1)} `;
  }
  const bars = Array.from({ length: 12 }, (_, i) => {
    const mu = 5.5;
    const h = Math.exp(-((i - mu) ** 2) / 8) * (120 + rnd() * 40) + rnd() * 18;
    // Avrundad här, så att staplarnas fot hamnar exakt på 235 nedan.
    return { x: 40 + i * 27, h: r1(h) };
  });

  return (
    <div className={cn("relative overflow-hidden bg-paper-2 text-ink", className)} aria-hidden={!label} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id={`g-${seed}`} cx="80%" cy="10%" r="90%">
            <stop offset="0" stopColor={accent} stopOpacity="0.32" />
            <stop offset="0.6" stopColor={accent} stopOpacity="0.04" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
                <rect width="400" height="250" fill={`url(#g-${seed})`} />
        <path d={GRID} fill="none" stroke="currentColor" strokeOpacity="0.07" />
        {variant === 0 &&
          points.map((p, i) => (
            <circle key={i} cx={r1(p.x)} cy={r1(p.y)} r={r1(p.r)} fill={p.red ? "#ff0707" : "currentColor"} fillOpacity={p.red ? 0.9 : 0.22} />
          ))}
        {variant === 1 &&
          bars.map((b, i) => (
            <rect key={i} x={b.x} y={r1(235 - b.h)} width="20" height={b.h} fill={i === 5 || i === 6 ? "#ff0707" : "currentColor"} fillOpacity={i === 5 || i === 6 ? 0.85 : 0.12} />
          ))}
        {variant !== 1 && <path d={line} fill="none" stroke="#ff0707" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {variant === 2 && (
          <path d={`${line} L410,260 L-10,260 Z`} fill="#ff0707" fillOpacity="0.12" />
        )}
      </svg>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- Inte lazy: på /nyheter är loggan i första kortet ofta det största som syns.
        <img
          src={logo}
          alt=""
          className="absolute -bottom-[18%] -right-[8%] w-[58%] max-w-none rotate-[-8deg] opacity-[0.9]"
        />
      )}
    </div>
  );
}
