"use client";

import { fetchSearchEntries } from "@/lib/search-prefetch";

/**
 * Sökrutan öppnas med en händelse, så att sökknapparna och snabbtangenterna inte behöver ha dialogens kod.
 * Värden (search-dialog-host.tsx) lyssnar och hämtar dialogen första gången den behövs.
 */
export const OPEN_SEARCH_EVENT = "statlin:oppna-sok";

/** Öppnar sökrutan, med en fråga ifylld om man vill. */
export function openSearch(query?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_SEARCH_EVENT, { detail: query }));
}

/** Hämtar dialogens kod och sökindexet i förväg, när pekaren eller fokus når en sökknapp. */
export function preloadSearch() {
  void import("./search-dialog");
  void fetchSearchEntries();
}

/** Ett vanligt klick, inte ett som ska öppna länken i en ny flik eller ett nytt fönster. */
export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
