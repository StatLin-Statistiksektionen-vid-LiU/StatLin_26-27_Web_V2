"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Millimeterpapper bakom startsidans hero, tonat mot kanterna. På en dator med mus lyser rutnätet upp i rött i en cirkel kring
 * pekaren. Läget skrivs som två CSS-variabler en gång per bildruta; masken i .hero-rutnat-ljus gör resten.
 * På sajtens sidor sköter RutnatLjus ljuset över hela sidan, och heron där har ljus={false}. Inloggningen har sitt eget ljus.
 */
export function HeroGrid({ className, ljus = true }: { className?: string; ljus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const section = el?.parentElement;
    if (!ljus || !el || !section) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    // Heronens läge på sidan mäts när den behövs första gången och efter storleksändringar, inte vid varje rörelse.
    let origin: { x: number; y: number } | null = null;
    const measure = () => {
      const r = section.getBoundingClientRect();
      origin = { x: r.left + window.scrollX, y: r.top + window.scrollY };
    };
    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.pageX;
      py = e.pageY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!origin) measure();
        el.style.setProperty("--mx", `${(px - origin!.x).toFixed(0)}px`);
        el.style.setProperty("--my", `${(py - origin!.y).toFixed(0)}px`);
        el.dataset.aktiv = "";
      });
    };
    const onLeave = () => delete el.dataset.aktiv;
    const onResize = () => (origin = null);

    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [ljus]);

  return (
    <div ref={ref} aria-hidden className={cn("hero-rutnat pointer-events-none absolute inset-0 -z-10 overflow-hidden text-ink", className)}>
      <div className="hero-rutnat-bas grid-millimeter absolute inset-0" />
      {ljus && <div className="hero-rutnat-ljus grid-millimeter absolute inset-0" />}
    </div>
  );
}
