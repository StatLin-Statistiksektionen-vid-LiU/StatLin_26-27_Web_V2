"use client";

import { useEffect, useRef } from "react";

/** Rutnätet i rött i en cirkel kring muspekaren, ovanpå panelens millimeterpapper. Läget skrivs som två CSS-variabler, och masken i .pekar-ljus gör resten. */
export function PekarLjus() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ljus = ref.current!;
    const panel = ljus.parentElement!;
    const av = new AbortController();
    const flytta = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = panel.getBoundingClientRect();
      ljus.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
      ljus.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
      ljus.dataset.aktiv = "";
    };
    panel.addEventListener("pointermove", flytta, { passive: true, signal: av.signal });
    panel.addEventListener("pointerleave", () => delete ljus.dataset.aktiv, { signal: av.signal });
    return () => av.abort();
  }, []);

  return <div ref={ref} aria-hidden className="pekar-ljus grid-millimeter pointer-events-none absolute inset-0 -z-10" />;
}
