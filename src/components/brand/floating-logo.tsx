"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { LOGO_GEOMETRY as G, LOGO_GRID, LOGO_SIGNATURE, LOGO_TEXT, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";
import { cn } from "@/lib/utils";

/**
 * Sektionsloggan som svävar i 3D och följer pekaren.
 * Loggan visas i sin officiella form, med en tunn vit kant som skiljer den svarta ringen från den svarta bakgrunden.
 * Introt bygger upp loggan lager för lager; slutläget är alltid den exakta loggan.
 * `ring` ligger i samma 3D-lager som loggan, och heron lägger formelringen där.
 * Med svavar={false} står loggan stilla och plant på papperet, utan glöd och reflex: så står den i startsidans hero, inskriven i rutnätet.
 */
export function FloatingLogo({ className, intro = true, svavar = true, ring }: { className?: string; intro?: boolean; svavar?: boolean; ring?: ReactNode }) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tiltRef.current;
    if (!el || !svavar) return;
    // En telefon gungar med CSS i stället, se .logo-tilt i globals.css.
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let running = true;
    let idle = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      idle = 0;
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const loop = (t: number) => {
      // När pekaren står stilla gungar loggan själv i en långsam Lissajous-bana.
      idle++;
      const auto = idle > 120;
      const ax = auto ? Math.sin(t / 2600) * 0.35 : targetX;
      const ay = auto ? Math.cos(t / 3400) * 0.25 : targetY;
      x += (ax - x) * 0.055;
      y += (ay - y) * 0.055;
      el.style.transform = `rotateX(${(-y * 10).toFixed(3)}deg) rotateY(${(x * 14).toFixed(3)}deg)`;
      if (running) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      if (visible && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(el);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [svavar]);

  return (
    <div className={cn("floating-logo relative aspect-square select-none", intro && "is-intro", className)}>
      {/* Röd glöd bakom loggan. Intoningen och andningen ligger på var sitt element: två animationer av samma egenskaper på ett element kan inte gå på grafikkortet, och då räknar huvudtråden om sidan i varje bildruta. */}
      {svavar && (
        <div aria-hidden className="logo-glow-in pointer-events-none absolute inset-[6%]">
          <div
            className="logo-glow h-full w-full rounded-full"
            style={{
              background: "radial-gradient(closest-side, rgb(255 7 7 / 0.38), rgb(255 7 7 / 0.12) 55%, transparent 75%)",
            }}
          />
        </div>
      )}
      <div className={cn("relative h-full w-full", svavar && "animate-float [perspective:1400px]")}>
        <div ref={tiltRef} className={cn("relative h-full w-full", svavar && "logo-tilt")} style={svavar ? { transformStyle: "preserve-3d", willChange: "transform" } : undefined}>
          {ring}
          <svg
            viewBox={LOGO_VIEWBOX}
            className="logo-mark relative h-full w-full overflow-visible"
            role="img"
            aria-label="StatLins sektionslogga: Statistiksektionen, Linköpings universitet"
          >
            <defs>
              <clipPath id={`${id}-disc`}>
                <circle cx={G.cx} cy={G.cy} r={G.ringR} />
              </clipPath>
              {/* Mjuk diagonal "wipe" som avslöjar signaturen nerifrån vänster – som en stigande graf. */}
              <linearGradient id={`${id}-wipe`} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.46" stopColor="#fff" />
                <stop offset="0.54" stopColor="#000" />
                <stop offset="1" stopColor="#000" />
              </linearGradient>
              <mask id={`${id}-sig`} maskUnits="userSpaceOnUse" x="-200" y="-200" width="1442" height="1442">
                <rect className="sig-wipe" x="-2000" y="-2000" width="4000" height="4000" fill={`url(#${id}-wipe)`} />
              </mask>
              <mask id={`${id}-grid`} maskUnits="userSpaceOnUse" x="0" y="0" width="1042" height="1042">
                <rect className="grid-wipe" x="0" y="0" width="1042" height="1042" fill="#fff" />
              </mask>
            </defs>

            <g className="logo-ring-group">
              <circle cx={G.cx} cy={G.cy} r={468} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              <circle cx={G.cx} cy={G.cy} r={G.discR} fill="#fff" />
              <g clipPath={`url(#${id}-disc)`} mask={`url(#${id}-grid)`}>
                <path d={LOGO_GRID} fill="#000" fillRule="evenodd" />
              </g>
              <circle cx={G.cx} cy={G.cy} r={G.ringR} fill="none" stroke="#000" strokeWidth={G.ringW} />
              <path className="logo-text" d={LOGO_TEXT} fill="#fff" fillRule="evenodd" />
            </g>
            <g mask={`url(#${id}-sig)`}>
              <path
                className="logo-signature"
                d={LOGO_SIGNATURE}
                fill="#ff0707"
                fillRule="evenodd"
                stroke="#fff"
                strokeWidth={7}
                strokeLinejoin="round"
                paintOrder="stroke"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Reflex under loggan */}
      {svavar && <div aria-hidden className="logo-reflex pointer-events-none absolute left-1/2 -translate-x-1/2 animate-float-shadow rounded-[50%]" />}
    </div>
  );
}
