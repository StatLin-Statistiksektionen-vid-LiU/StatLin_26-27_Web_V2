"use client";

import { useEffect, useRef } from "react";

/**
 * Månadsraden på telefonen börjar vid den valda månaden eller den innevarande, inte alltid i januari. Den följer också med när
 * månaden väljs i hjulet, som ligger under listan.
 */
export function ScrollChipIntoView({ target, month }: { target: string; month: number | null }) {
  useEffect(() => {
    const nav = document.getElementById(target);
    const chip = nav?.querySelector<HTMLElement>('[aria-current="true"]:not([data-alla]), [data-nu]');
    if (nav && chip) nav.scrollLeft = chip.offsetLeft - nav.offsetLeft - 8;
  }, [target, month]);
  return null;
}

/**
 * På telefonen ligger hjulet under listan, så ett klick på en månad byter innehåll utanför skärmen. När filtret ändras och listans
 * början inte syns flyttas sidan dit. Hjulets länkar har scroll={false}, så att sidan inte hoppar på datorn där listan redan syns.
 */
export function ScrollToListOnFilter({ month, target }: { month: number | null; target: string }) {
  const last = useRef(month);
  useEffect(() => {
    if (last.current === month) return;
    last.current = month;
    const el = document.getElementById(target);
    if (!el) return;
    const { top } = el.getBoundingClientRect();
    if (top >= 0 && top < window.innerHeight * 0.5) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [month, target]);
  return null;
}
