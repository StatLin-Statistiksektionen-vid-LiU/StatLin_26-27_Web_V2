import { parseSeeks, SEEK_LABELS, type StarCompany } from "@/lib/naringsliv";
import { narrowMap, wideMap, type StarMap as Layout } from "@/lib/star-map";
import "./star.css";

const LINE = { stroke: "#fff", strokeOpacity: 0.32, strokeWidth: 1 };
/**
 * Kartans bredd i dess egna mått på surfplatta och dator. Den står i avsnittets spalt, som är omkring så bred i pixlar, och då
 * får namnen på kartan sin riktiga storlek (star.css håller kartan under 52rem).
 */
const KARTA_BREDD = 760;

/** Stjärnan: huvudsponsorn med en tunn ring, som en ljusstark stjärna på en stjärnkarta, sponsorer större än utställare. */
function StarShape({ x, y, role }: { x: number; y: number; role: StarCompany["role"] }) {
  if (role === "huvudsponsor") {
    return (
      <>
        <circle cx={x} cy={y} r="11" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
        <circle className="star-core" cx={x} cy={y} r="6" fill="#fff" />
      </>
    );
  }
  return <circle className="star-core" cx={x} cy={y} r={role === "sponsor" ? 5 : 3.5} fill="#fff" />;
}

function Map({ layout, companies, size, className }: { layout: Layout; companies: StarCompany[]; size: "wide" | "narrow"; className: string }) {
  const byId = new globalThis.Map(companies.map((c) => [c.id, c]));
  const fontSize = size === "wide" ? 13.5 : 13;
  return (
    <div data-star-in className={`star-karta relative ${className}`}>
    <svg
      className="star-map block h-auto w-full"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label="Stjärnkarta över företagen. Varje stjärna leder till företagets kort."
    >
      <defs>
        <radialGradient id={`star-halo-${size}`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="star-lines" {...LINE}>
        {layout.lines.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={layout.stars[a].x} y1={layout.stars[a].y} x2={layout.stars[b].x} y2={layout.stars[b].y} />
        ))}
      </g>
      {layout.stars.map((s) => {
        const company = byId.get(s.id)!;
        const seeks = parseSeeks(company.seeks);
        const offset = s.anchor === "start" ? 14 : -14;
        return (
          <g key={s.id} className="star-node" data-seeks={company.seeks}>
            <circle className="star-ghost" cx={s.x} cy={s.y} r="2.5" fill="#fff" />
            <a href={`#foretag-${company.id}`} aria-label={`${company.name}, till kortet`}>
              {/* Träffytan: 44 pixlar på telefonen, och hela namnet räknas också. */}
              <circle cx={s.x} cy={s.y} r="24" fill="transparent" />
              <circle className="star-halo" cx={s.x} cy={s.y} r="20" fill={`url(#star-halo-${size})`} />
              <circle className="star-ring" cx={s.x} cy={s.y} r="17" fill="none" strokeWidth="1.5" />
              <StarShape x={s.x} y={s.y} role={company.role} />
              <text className="star-type star-name" x={s.x + offset} y={s.y + 4.5} textAnchor={s.anchor} fontSize={fontSize} letterSpacing="0.04em">
                {s.label}
              </text>
              {seeks.length > 0 && size === "wide" && (
                <text className="star-seeks" x={s.x + offset} y={s.y + 21} textAnchor={s.anchor} fontSize="11.5" fontFamily="var(--font-mono)">
                  {seeks.map((k) => SEEK_LABELS[k]).join(" · ")}
                </text>
              )}
            </a>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** Företagen som en stjärnbild. Ett komplement: korten under är den fullständiga listan. Fungerar helt utan JavaScript. */
export function StarMap({ companies }: { companies: StarCompany[] }) {
  return (
    <>
      <Map layout={wideMap(companies, KARTA_BREDD)} companies={companies} size="wide" className="hidden md:block" />
      <Map layout={narrowMap(companies)} companies={companies} size="narrow" className="md:hidden" />
    </>
  );
}

/** Tom karta: grafen ur loggan med släckta stjärnor, så att sidan är vacker innan företagen är klara. */
export function EmptySky() {
  const points = [
    [60, 300],
    [210, 225],
    [340, 250],
    [500, 150],
    [640, 170],
    [790, 70],
    [940, 100],
  ];
  return (
    <svg className="block h-auto w-full" viewBox="0 0 1000 360" aria-hidden>
      <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="9" fill="var(--color-star-navy)" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
