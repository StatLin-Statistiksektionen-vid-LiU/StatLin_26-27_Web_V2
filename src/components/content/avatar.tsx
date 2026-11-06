import { useId } from "react";
import { SmartImage } from "./smart-image";
import type { ImageRef } from "@/lib/types";
import { cn, hashString, initials, mulberry32 } from "@/lib/utils";

/** Porträtt, eller generativ platshållare med initialer om foto saknas. */
export function Avatar({
  name,
  seed,
  photo,
  className,
}: {
  name: string;
  seed: string;
  photo: ImageRef | null;
  className?: string;
}) {
  const id = useId();
  if (photo) {
    return (
      <div className={cn("relative overflow-hidden bg-paper-2", className)}>
        <SmartImage image={photo} sizes="(min-width: 1024px) 25vw, 50vw" className="h-full w-full" alt={name} />
      </div>
    );
  }
  // Eget id per ruta: seed kan innehålla mellanslag, och samma post kan stå två gånger i dokumentet (dolda sidor i <Activity>).
  const gradientId = `av-${id}`;
  const rnd = mulberry32(hashString(seed));
  const angle = Math.round(rnd() * 360);
  const rings = Array.from({ length: 5 }, (_, i) => 30 + i * 22 + rnd() * 10);
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-paper-2 text-ink", className)} role="img" aria-label={name}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gradientId} gradientTransform={`rotate(${angle} .5 .5)`}>
            <stop offset="0" stopColor="#ff0707" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ff0707" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill={`url(#${gradientId})`} />
        {rings.map((r, i) => (
          <circle key={i} cx={rnd() > 0.5 ? 200 : 0} cy="200" r={r * 1.6} fill="none" stroke="currentColor" strokeOpacity="0.08" />
        ))}
      </svg>
      <span className="display relative text-[2.6rem] text-ink">{initials(name)}</span>
    </div>
  );
}
