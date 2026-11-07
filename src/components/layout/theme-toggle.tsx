"use client";

import { type MouseEvent, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Samma nyckel som skriptet i src/app/layout.tsx läser innan sidan ritas. */
const KEY = "statlin-tema";
/** Webbläsarens adressfält på telefon får sidans bakgrund i båda lägena. */
const THEME_COLORS = { ljust: "#f9f8f5", mork: "#121211" };

// Knappen finns både i sidomenyn och i telefonens meny, så båda får veta när läget byts.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const isDark = () => document.documentElement.dataset.tema === "mork";

function apply(dark: boolean) {
  const root = document.documentElement;
  if (dark) root.dataset.tema = "mork";
  else delete root.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? THEME_COLORS.mork : THEME_COLORS.ljust);
  try {
    // Båda valen sparas, så att besökarens val står kvar även om standardläget ändras.
    localStorage.setItem(KEY, dark ? "mork" : "ljust");
  } catch {
    /* lagring blockerad: läget gäller tills sidan laddas om */
  }
  listeners.forEach((l) => l());
}

/**
 * Byter mellan ljust och mörkt läge, och valet sparas i webbläsaren. Den som inte valt får standardläget från Admin, se src/lib/tema.ts.
 * Där webbläsaren kan View Transitions sprider sig det nya läget som en cirkel från knappen; annars byts det direkt.
 */
export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  // Servern ritar knappen för mörkt läge. Är sidan ljus byts ikonen efter hydreringen.
  const dark = useSyncExternalStore(subscribe, isDark, () => true);
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const next = !isDark();
    const root = document.documentElement;
    if (typeof document.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(next);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    // Klassen begränsar övergångens CSS till temabytet, så att andra övergångar på sidan inte påverkas.
    root.classList.add("tema-byte");
    const transition = document.startViewTransition(() => flushSync(() => apply(next)));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 560, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    transition.finished.finally(() => root.classList.remove("tema-byte"));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Mörkt läge"
      title={dark ? "Byt till ljust läge" : "Byt till mörkt läge"}
      className={cn("inline-flex items-center justify-center gap-2", className)}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {withLabel && <span>{dark ? "Ljust läge" : "Mörkt läge"}</span>}
    </button>
  );
}
