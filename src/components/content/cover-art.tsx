import type { CSSProperties } from "react";
import { cn, hashString, mulberry32 } from "@/lib/utils";

/*
 * Omslaget som ritas när en nyhet eller ett evenemang saknar bild: en ton av färg från ena sidan, tunna ringar och ett märke,
 * i samma anda som plattan styrelsens poster får utan foto (Avatar). Har utskottet en logga står den i mitten med ringarna
 * omkring sig, som nivåkurvor kring en topp. Utan logga står sektionens märke stort och svagt till höger, som på det röda kortet
 * på startsidan, och ringarna går ut från det. Tonen är utskottets färg när den har en kulör, annars sajtens röda. Vinkeln och
 * ringarnas mått väljs efter nyckeln, så att samma nyhet alltid får samma omslag. Tonen och märket är CSS (.cover-art och
 * .cover-marke i globals.css), eftersom omslaget står både i HTML:en och i sidans RSC-data, ibland nio gånger på en sida.
 */

/** Utskottets färg, om den har någon kulör och inte är röd. Svart, grått och rött ger sajtens röda (--color-red). */
function kulor(accent?: string | null) {
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return undefined;
  const n = parseInt(accent.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 48 || (r > 150 && g < 90 && b < 90)) return undefined;
  return accent;
}

/**
 * Ringarnas radie och styrka i en rityta som är 320 gånger 200 och ryms i omslaget (meet). Omslagen är breda, så ritytan följer
 * omslagets höjd, precis som loggan och märket gör. Kring loggan utgår ringarna från mitten.
 */
const KRING_LOGGAN: [number, number][] = [
  [46, 0.16],
  [66, 0.13],
  [92, 0.1],
  [126, 0.07],
  [170, 0.04],
];
/** Märket är 300 brett med mitten i x = 206 (.cover-marke), så ringarna börjar strax utanför det. */
const KRING_MARKET: [number, number][] = [
  [163, 0.13],
  [186, 0.1],
  [214, 0.07],
  [248, 0.04],
];

export function CoverArt({
  seed,
  accent,
  logo,
  className,
  label,
}: {
  seed: string;
  accent?: string | null;
  /** Utskottets logga. Utan den står sektionens märke som vattenmärke. */
  logo?: string | null;
  className?: string;
  label?: string;
}) {
  const rnd = mulberry32(hashString(seed));
  const vinkel = Math.round(rnd() * 360);
  // Ringarna flyttas några enheter efter nyckeln, så att två omslag bredvid varandra inte blir helt lika.
  const ringar = (logo ? KRING_LOGGAN : KRING_MARKET).map(([r, o]) => [Math.round(r + rnd() * 8 - 4), o] as const);
  const farg = kulor(accent);
  return (
    <div
      className={cn("cover-art relative grid place-items-center overflow-hidden bg-paper-2 text-ink", className)}
      data-farg={farg ? "" : undefined}
      style={{ "--omslag-vinkel": `${vinkel}deg`, ...(farg ? { "--omslag-utskott": farg } : null) } as CSSProperties}
      aria-hidden={!label}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {/* Bilden täcker omslaget, och ringarna ritas även utanför ritytan. Med märket hålls ritytan mot högerkanten, där märket står. */}
      <svg viewBox="0 0 320 200" preserveAspectRatio={logo ? "xMidYMid meet" : "xMaxYMid meet"} className="absolute inset-0 h-full w-full" aria-hidden>
        {ringar.map(([r, o], i) => (
          <circle key={i} cx={logo ? 160 : 206} cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity={o} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Inte lazy: på /nyheter är loggan i första kortet ofta det största som syns.
        <img src={logo} alt="" className="relative h-[36%] w-auto max-w-[30%] object-contain drop-shadow-[0_6px_14px_rgb(0_0_0/0.35)]" />
      ) : (
        <span className="cover-marke" />
      )}
    </div>
  );
}
