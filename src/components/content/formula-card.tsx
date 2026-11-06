import type { ReactNode } from "react";
import type { FormulaArt } from "@/components/content/formula-art";
import { cn } from "@/lib/utils";

/**
 * Dekor i sidhuvudet: ett kort med en formel, färdigsatt som i LaTeX (se formula-art). Storleken följer kortets bredd, så
 * att formeln alltid ryms på en rad.
 */
export function FormulaCard({ kicker, tilt, facts, art }: { kicker: string; tilt: "left" | "right"; facts: ReactNode; art: FormulaArt }) {
  return (
    <div className={cn("w-full rounded-2xl border border-line bg-white p-5 md:max-w-sm md:p-5 lg:p-7", tilt === "right" ? "md:rotate-2" : "md:-rotate-2")}>
      <p className="kicker text-stone">{kicker}</p>
      <div className="@container mt-3 md:mt-4">
        <div className="text-ink" style={{ fontSize: `min(2.1rem, ${(100 / art.width).toFixed(2)}cqi)` }}>
          <svg role="img" aria-label={art.label} viewBox={art.viewBox} fill="currentColor" className="block" style={{ width: `${art.width}em`, height: `${art.height}em` }}>
            {art.glyphs.map(([transform, d], index) => (
              <path key={index} transform={transform} d={d} />
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-5 hidden h-px bg-line lg:block" />
      <p className="mt-4 hidden font-mono text-xs leading-relaxed text-stone lg:block">{facts}</p>
    </div>
  );
}
