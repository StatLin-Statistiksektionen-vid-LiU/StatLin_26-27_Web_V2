"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Grupper som redan har tonats in i det här fönstret. Fylls bara i webbläsaren, eftersom effekter inte körs på servern. */
const played = new Set<string>();

/**
 * Ett listelement som tonas in första gången det visas. När Next hämtar delen igen efter ett sidbyte tillbaka, eller visar en sida som
 * legat dold, står det still i stället för att tonas in en gång till.
 */
export function FadeInOnce({ group, delay, children }: { group: string; delay: number; children: ReactNode }) {
  const [animate, setAnimate] = useState(() => !played.has(group));
  useEffect(() => {
    played.add(group);
  }, [group]);
  return (
    <li
      className={animate ? "[animation:fade-up_0.7s_var(--ease-out-expo)_backwards]" : undefined}
      style={animate ? { animationDelay: `${delay}s` } : undefined}
      onAnimationEnd={animate ? () => setAnimate(false) : undefined}
    >
      {children}
    </li>
  );
}
