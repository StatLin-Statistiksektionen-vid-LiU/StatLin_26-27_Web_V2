import type { CSSProperties, ReactNode } from "react";
import type { Logglager, MotivNamn } from "@/lib/karaktar";
import { cn } from "@/lib/utils";
import { MOTIV_POSTER } from "./motiv-poster";
import { MOTIV_UTSKOTT, SCEN_UTSKOTT } from "./motiv-utskott";

const MOTIV: Record<MotivNamn, ReactNode> = { ...MOTIV_UTSKOTT, ...MOTIV_POSTER };
const SCEN: Partial<Record<MotivNamn, ReactNode>> = SCEN_UTSKOTT;

/**
 * Loggan med sitt motiv runt om: fotbollsplanen runt STIG:s boll, vimplarna över SCB, mynten runt kassören. Motivet är ritat på
 * 400 × 400 med loggan i mitten (radie 120). Linjerna har textens färg, och det som är utskottets eget har --motiv.
 *
 * Med entre spelas motivets entré upp när sidan öppnas (.entre i globals.css): linjerna ritas, och loggan byggs upp av sina
 * lager (scripts/logglager.mjs), bilden först och signaturen skriven över den sist. Utan lager kommer loggan in hel, och utan
 * motiv, som för styrelsen, står loggan ensam.
 */
export function Emblem({
  motiv,
  logo,
  lager,
  entre,
  className,
  logoClassName,
}: {
  motiv?: MotivNamn;
  logo: string | null;
  lager?: Logglager | null;
  entre?: boolean;
  className?: string;
  logoClassName?: string;
}) {
  return (
    // Platsen (relative eller absolute) bestämmer den som använder emblemet.
    <div className={cn("emblem aspect-square", entre && "entre", className)} data-motiv={motiv}>
      {motiv && (
        <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="absolute inset-0 size-full overflow-visible">
          {MOTIV[motiv]}
        </svg>
      )}
      {logo &&
        (entre && lager ? (
          <div className="e-logga absolute inset-[20%]" style={{ "--bild": `url(${lager.bild})` } as CSSProperties}>
            <span className="e-papper" />
            {/* eslint-disable @next/next/no-img-element */}
            <div className="e-bana">
              <img src={lager.bild} alt="" fetchPriority="high" className="e-inre" />
            </div>
            <img src={lager.bild} alt="" className="e-ring" />
            <img src={lager.skrift} alt="" className="e-skrift" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" fetchPriority="high" className={cn("e-hel absolute inset-[20%] size-[60%] object-contain", logoClassName)} />
        ))}
      {/* Scenen ligger överst, så att det som flyger in syns över loggans lager. */}
      {entre && lager && motiv && SCEN[motiv] && (
        <svg viewBox="0 0 400 400" aria-hidden className="e-scen absolute inset-0 size-full overflow-visible">
          {SCEN[motiv]}
        </svg>
      )}
    </div>
  );
}
