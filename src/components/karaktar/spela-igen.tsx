"use client";

import type { ReactNode } from "react";

/**
 * Ett tryck på emblemet spelar entrén en gång till. Animationerna hänger på klassen entre (globals.css), så den tas bort och
 * sätts tillbaka: då börjar de om. Emblemet självt ritas på servern och skickas in som barn.
 */
export function SpelaIgen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      title="Visa entrén igen"
      aria-label="Visa entrén igen"
      className={className}
      onClick={(e) => {
        const emblem = e.currentTarget.querySelector<HTMLElement>(".emblem");
        if (!emblem) return;
        emblem.classList.remove("entre");
        // Läsningen tvingar fram en ny layout, så att webbläsaren ser klassen försvinna innan den kommer tillbaka.
        void emblem.offsetWidth;
        emblem.classList.add("entre");
      }}
    >
      {children}
    </button>
  );
}
