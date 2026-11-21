"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Märket för en sida vars topp alltid är mörk, oavsett läge: startsidans två heroer, STAR-himlen och himlen på
 * lunchföreläsningarna. Listen överst är genomskinlig högst upp på sidan, och över en sådan topp får den mörka lägets färger
 * (.sidhuvud i globals.css). Annars står ljusa lägets mörka text mot det mörka.
 *
 * Next har kvar förra sidan dold i dokumentet. Märket tas därför bort medan sidan är dold och sätts tillbaka när den visas igen.
 */
export function MorkTopp() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const marke = ref.current;
    if (!marke) return;
    marke.setAttribute("data-mork-topp", "");
    return () => marke.removeAttribute("data-mork-topp");
  }, []);
  return <span ref={ref} data-mork-topp="" hidden />;
}
