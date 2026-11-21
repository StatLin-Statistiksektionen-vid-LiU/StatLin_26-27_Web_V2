"use client";

import { useLayoutEffect, useRef } from "react";

/** Händelsen som säger till listen överst att en hero har kommit eller försvunnit, så att den mäter om (site-header.tsx). */
export const HERO_ANDRAD = "statlin:hero";

/**
 * Märket för en sida som börjar med en hero i fönstrets storlek, utöver startsidan: STAR-sidan och inbjudan till företag.
 * Listen överst är genomskinlig tills herons egen logga (data-hero-grans) når den (.sidhuvud i globals.css och useScrollad i
 * site-header.tsx, som hittar heron med data-hero-yta). Med logga="star" byts sektionens logga i listen mot STAR-dagens i
 * samma stund, så att loggan ser ut att flytta upp i listen.
 *
 * Next har kvar förra sidan dold i dokumentet. Märket tas därför bort medan sidan är dold och sätts tillbaka när den visas
 * igen. Listen får veta det, för heron kan komma efter att sidan har bytts, när sidan strömmas.
 */
export function HeroTopp({ logga }: { logga?: "star" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const marke = ref.current;
    if (!marke) return;
    marke.setAttribute("data-hero-topp", logga ?? "");
    window.dispatchEvent(new Event(HERO_ANDRAD));
    return () => {
      marke.removeAttribute("data-hero-topp");
      window.dispatchEvent(new Event(HERO_ANDRAD));
    };
  }, [logga]);
  return <span ref={ref} data-hero-topp={logga ?? ""} hidden />;
}
