import type { CSSProperties } from "react";
import type { Lov, Ruta } from "./formel";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const klasser = (l: Extract<Lov, { typ: "text" }>) => ["hs-ord", l.rod && "f-rod", l.bf && "f-bf", l.bb && "f-bb"].filter(Boolean).join(" ");

/**
 * En formel från ritaFormel (formel.ts) i em av omgivningens textstorlek. Orden och strecken skrivs fram med handstilens CSS, som
 * styrs av data-skriv på en förälder med klassen handskrift. Ett ord har radhöjd 1, så baslinjen ligger 0,775 em under dess överkant.
 */
export function FormelVy({ ruta, className, style }: { ruta: Ruta; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={className ? `formel ${className}` : "formel"}
      style={{ width: `${r3(ruta.w)}em`, height: `${r3(ruta.h + ruta.d)}em`, verticalAlign: `${r3(-ruta.d)}em`, ...style }}
    >
      {ruta.lov.map((l, i) =>
        l.typ === "text" ? (
          <span
            key={i}
            className={klasser(l)}
            style={{ left: `${r3(l.x / l.k)}em`, top: `${r3((ruta.h + l.y) / l.k - 0.775)}em`, fontSize: `${r3(l.k)}em`, "--d": Math.round(l.d), "--t": Math.max(1, Math.round(l.t)) } as CSSProperties}
          >
            {l.s}
          </span>
        ) : (
          <svg
            key={i}
            className={l.rod ? "hs-ritning f-rod" : "hs-ritning"}
            viewBox={`0 0 ${r3((l.w * 100) / l.k)} ${r3((l.h * 100) / l.k)}`}
            style={{ left: `${r3(l.x)}em`, top: `${r3(ruta.h + l.y)}em`, width: `${r3(l.w)}em`, height: `${r3(l.h)}em` }}
            strokeWidth={l.sw}
          >
            {l.streck.map((s, j) => (
              <path key={j} d={s.d} pathLength={1} style={{ "--rd": s.rd, "--rt": s.rt } as CSSProperties} />
            ))}
            {l.prickar.map((q, j) => (
              <path key={`p${j}`} d={`M ${q.x} ${q.y} l 0.4 0`} pathLength={1} strokeWidth={l.sw * 1.7} style={{ "--rd": q.rd, "--rt": 60 } as CSSProperties} />
            ))}
          </svg>
        ),
      )}
    </span>
  );
}
