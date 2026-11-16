import Link from "next/link";
import { ArrowLeft } from "@/components/icons";

/**
 * 404: sidan ligger utanför konfidensintervallet. Under sajtens layout står den redan i sidans main och ritas som en div,
 * utanför den är den själv sidans main.
 */
export function NotFoundView({ as: Tag }: { as: "main" | "div" }) {
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * 8 - 4;
    pts.push(`${i * 10},${(210 - Math.exp(-(x * x) / 2) * 190).toFixed(1)}`);
  }
  return (
    <Tag className="noise relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center text-white">
      <div className="grid-paper pointer-events-none absolute inset-0 text-white [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="relative w-full max-w-2xl">
        {/* Kurvan och baslinjen ritas i textens färg. Ytan är omvänd mot sidan, alltså ljus i mörkt läge, och där syntes inte fast vitt. */}
        <svg viewBox="0 0 1000 230" className="w-full" aria-hidden>
          <polygon points={`95,210 ${pts.slice(10, 91).join(" ")} 905,210`} fill="#ff0707" fillOpacity="0.12" />
          <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="0" x2="1000" y1="210" y2="210" stroke="currentColor" strokeOpacity="0.2" />
          <line x1="975" x2="975" y1="40" y2="210" stroke="#ff0707" strokeWidth="2" strokeDasharray="5 6" />
          <circle cx="975" cy="205" r="9" fill="#ff0707" className="animate-ping [transform-box:fill-box] [transform-origin:center]" />
          <circle cx="975" cy="205" r="7" fill="#ff0707" />
          <text x="965" y="30" fill="#ff0707" fontFamily="JetBrains Mono Variable, monospace" fontSize="22" textAnchor="end">
            du är här
          </text>
        </svg>
        <p className="kicker mt-10 text-red">Fel 404 · p = 0,0004</p>
        {/* Mjukt bindestreck: ordet är bredare än spalten och får brytas i sammansättningen. */}
        <h1 className="display mt-5 text-[clamp(1.9rem,7vw,4.5rem)]">
          Utanför <span className="text-red">konfidens&shy;</span>intervallet
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-white/65">
          Sidan du letar efter finns inte, eller så har den flyttats. Vi förkastar nollhypotesen att du hamnade rätt.
        </p>
        <Link href="/" className="btn btn-red mt-10">
          <ArrowLeft size={18} /> Tillbaka till startsidan
        </Link>
      </div>
    </Tag>
  );
}
